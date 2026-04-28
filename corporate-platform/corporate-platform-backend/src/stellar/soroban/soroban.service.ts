import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  ContractExecutionResult,
  ContractInvocation,
  ContractSimulation,
} from './contracts/contract.interface';
import * as StellarSdk from '@stellar/stellar-sdk';

@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly rpc: StellarSdk.rpc.Server;
  private readonly networkPassphrase: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const stellarConfig = this.configService.getStellarConfig();
    this.rpc = new StellarSdk.rpc.Server(
      stellarConfig.sorobanRpcUrl || 'https://soroban-testnet.stellar.org:443',
    );
    this.networkPassphrase =
      stellarConfig.network === 'public'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;
  }

  getRpcClient() {
    return this.rpc;
  }

  async simulateContractCall(
    payload: ContractSimulation,
  ): Promise<Record<string, unknown>> {
    this.ensureCallInput(payload.contractId, payload.methodName);

    const args = (payload.args || []).map((arg) => this.toScVal(arg));
    const sourceAccount = new StellarSdk.Account(
      StellarSdk.Keypair.random().publicKey(),
      '0',
    );
    const contract = new StellarSdk.Contract(payload.contractId);

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(payload.methodName, ...args))
      .setTimeout(30)
      .build();

    const simulation = await this.rpc.simulateTransaction(tx as any);
    const retval = this.extractReturnValue(simulation);

    return {
      contractId: payload.contractId,
      methodName: payload.methodName,
      result: retval,
      simulation,
    };
  }

  async invokeContract(
    payload: ContractInvocation,
  ): Promise<ContractExecutionResult> {
    this.ensureCallInput(payload.contractId, payload.methodName);

    const args = payload.args || [];
    const secret = process.env.STELLAR_SECRET_KEY;

    if (!secret) {
      const simulated = await this.simulateContractCall({
        contractId: payload.contractId,
        methodName: payload.methodName,
        args,
      });

      const txHash = `sim_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
      const submittedAt = new Date();

      await this.prisma.contractCall.create({
        data: {
          companyId: payload.companyId,
          contractId: payload.contractId,
          methodName: payload.methodName,
          transactionHash: txHash,
          args: this.toJson(args),
          status: 'CONFIRMED',
          result: this.toJson(simulated),
          submittedAt,
          confirmedAt: submittedAt,
        },
      });

      return {
        contractId: payload.contractId,
        methodName: payload.methodName,
        transactionHash: txHash,
        status: 'CONFIRMED',
        result: simulated,
        submittedAt: submittedAt.toISOString(),
        confirmedAt: submittedAt.toISOString(),
        source: 'simulated',
      };
    }

    const keypair = StellarSdk.Keypair.fromSecret(secret);
    const sourceAccount = await this.rpc.getAccount(keypair.publicKey());
    const contract = new StellarSdk.Contract(payload.contractId);
    const scArgs = args.map((arg) => this.toScVal(arg));

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(payload.methodName, ...scArgs))
      .setTimeout(60)
      .build();

    const prepared = await this.rpc.prepareTransaction(tx as any);
    prepared.sign(keypair);

    const submittedAt = new Date();
    const sendResponse = await this.rpc.sendTransaction(prepared as any);
    const txHash = (sendResponse as any).hash || this.fallbackHash();

    if ((sendResponse as any).status === 'ERROR') {
      await this.prisma.contractCall.create({
        data: {
          companyId: payload.companyId,
          contractId: payload.contractId,
          methodName: payload.methodName,
          transactionHash: txHash,
          args: this.toJson(args),
          status: 'FAILED',
          result: this.toJson(sendResponse),
          submittedAt,
        },
      });
      throw new InternalServerErrorException(
        `Contract invocation failed: ${JSON.stringify(sendResponse)}`,
      );
    }

    let status: 'PENDING' | 'CONFIRMED' = 'PENDING';
    let confirmedAt: Date | null = null;
    let txDetails: unknown = null;

    try {
      txDetails = await this.getTransaction(txHash);
      const txStatus = String((txDetails as any)?.status || '').toUpperCase();
      if (txStatus === 'SUCCESS') {
        status = 'CONFIRMED';
        confirmedAt = new Date();
      }
    } catch (error) {
      this.logger.warn(
        `Unable to fetch tx ${txHash} immediately after send: ${this.getErrorMessage(error)}`,
      );
    }

    await this.prisma.contractCall.create({
      data: {
        companyId: payload.companyId,
        contractId: payload.contractId,
        methodName: payload.methodName,
        transactionHash: txHash,
        args: this.toJson(args),
        status,
        result: this.toJson(txDetails || sendResponse),
        submittedAt,
        confirmedAt: confirmedAt || undefined,
      },
    });

    return {
      contractId: payload.contractId,
      methodName: payload.methodName,
      transactionHash: txHash,
      status,
      result: txDetails || sendResponse,
      submittedAt: submittedAt.toISOString(),
      confirmedAt: confirmedAt?.toISOString(),
      source: 'onchain',
    };
  }

  async getTransaction(txHash: string): Promise<unknown> {
    if (!txHash) {
      throw new BadRequestException('Transaction hash is required');
    }
    return this.rpc.getTransaction(txHash);
  }

  async getContractEvents(
    contractId: string,
    startLedger: number,
  ): Promise<any[]> {
    const safeStartLedger = Number.isFinite(startLedger)
      ? Math.max(1, Math.floor(startLedger))
      : 1;

    try {
      const response = await this.rpc.getEvents({
        startLedger: safeStartLedger,
        filters: [
          {
            type: 'contract',
            contractIds: [contractId],
          },
        ],
      });

      return response.events || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch contract events: ${this.getErrorMessage(error)}`,
      );
      return [];
    }
  }

  async getLatestLedgerSequence(): Promise<number> {
    try {
      const latest = await this.rpc.getLatestLedger();
      return Number((latest as any)?.sequence || 0);
    } catch (error) {
      this.logger.warn(
        `Could not fetch latest ledger sequence: ${this.getErrorMessage(error)}`,
      );
      return 0;
    }
  }

  decodeScVal(scVal: unknown): unknown {
    try {
      return StellarSdk.scValToNative(scVal as any);
    } catch {
      return scVal;
    }
  }

  private ensureCallInput(contractId: string, methodName: string) {
    if (!contractId || !contractId.trim()) {
      throw new BadRequestException('contractId is required');
    }
    if (!methodName || !methodName.trim()) {
      throw new BadRequestException('methodName is required');
    }
  }

  private extractReturnValue(simulation: unknown): unknown {
    const candidate =
      (simulation as any)?.result?.retval ??
      (simulation as any)?.retval ??
      (simulation as any)?.results?.[0]?.retval;

    if (!candidate) {
      return null;
    }

    try {
      const scVal =
        typeof candidate === 'string'
          ? StellarSdk.xdr.ScVal.fromXDR(candidate, 'base64')
          : candidate;
      return StellarSdk.scValToNative(scVal as any);
    } catch {
      return candidate;
    }
  }

  private toScVal(value: unknown): StellarSdk.xdr.ScVal {
    if (
      typeof value === 'object' &&
      value !== null &&
      'type' in (value as Record<string, unknown>)
    ) {
      const typed = value as { type: string; value: unknown };
      return StellarSdk.nativeToScVal(typed.value as any, {
        type: typed.type as any,
      });
    }

    if (typeof value === 'bigint') {
      return StellarSdk.nativeToScVal(value, { type: 'i128' });
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return StellarSdk.nativeToScVal(value, { type: 'i128' });
      }
      return StellarSdk.nativeToScVal(value, { type: 'f64' });
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('G') && trimmed.length >= 56) {
        return StellarSdk.nativeToScVal(trimmed, { type: 'address' });
      }
      return StellarSdk.nativeToScVal(trimmed, { type: 'string' });
    }

    if (typeof value === 'boolean') {
      return StellarSdk.nativeToScVal(value, { type: 'bool' });
    }

    return StellarSdk.nativeToScVal(value as any);
  }

  private fallbackHash() {
    return `tx_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
