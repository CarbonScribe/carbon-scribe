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
import { TimeoutError } from '../../shared/exceptions/timeout-error';

/**
 * Soroban Service with timeout and retry configuration
 *
 * Timeout defaults:
 * - simulateTransaction: 30s
 * - sendTransaction: 60s
 * - getTransaction: 10s
 * - getEvents: 15s
 * - getLatestLedger: 10s
 */
@Injectable()
export class SorobanService {
  private readonly logger = new Logger(SorobanService.name);
  private readonly rpc: StellarSdk.rpc.Server;
  private readonly networkPassphrase: string;

  // Timeout configurations (in milliseconds)
  private readonly simulateTimeout: number;
  private readonly sendTimeout: number;
  private readonly getTransactionTimeout: number;
  private readonly getEventsTimeout: number;
  private readonly getLatestLedgerTimeout: number;

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

    // Load timeouts from config with defaults
    this.simulateTimeout = stellarConfig.simulateTimeout || 30000;
    this.sendTimeout = stellarConfig.sendTimeout || 60000;
    this.getTransactionTimeout = stellarConfig.getTransactionTimeout || 10000;
    this.getEventsTimeout = stellarConfig.getEventsTimeout || 15000;
    this.getLatestLedgerTimeout = stellarConfig.getLatestLedgerTimeout || 10000;
  }

  getRpcClient() {
    return this.rpc;
  }

  /**
   * Simulate a contract call with timeout
   * Default timeout: 30 seconds
   */
  async simulateContractCall(
    payload: ContractSimulation,
    signal?: AbortSignal,
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

    const simulation = await this.executeWithTimeout(
      this.rpc.simulateTransaction(tx as any),
      this.simulateTimeout,
      `simulateContractCall for ${payload.contractId}.${payload.methodName}`,
      signal,
    );

    const retval = this.extractReturnValue(simulation);

    return {
      contractId: payload.contractId,
      methodName: payload.methodName,
      result: retval,
      simulation,
    };
  }

  /**
   * Invoke a contract with timeout
   * Default timeout: 60 seconds
   */
  async invokeContract(
    payload: ContractInvocation,
    signal?: AbortSignal,
  ): Promise<ContractExecutionResult> {
    this.ensureCallInput(payload.contractId, payload.methodName);

    const args = payload.args || [];
    const secret = process.env.STELLAR_SECRET_KEY;

    if (!secret) {
      const simulated = await this.simulateContractCall(
        {
          contractId: payload.contractId,
          methodName: payload.methodName,
          args,
        },
        signal,
      );

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
    const sourceAccount = await this.executeWithTimeout(
      this.rpc.getAccount(keypair.publicKey()),
      this.simulateTimeout,
      `getAccount for ${keypair.publicKey()}`,
      signal,
    );

    const contract = new StellarSdk.Contract(payload.contractId);
    const scArgs = args.map((arg) => this.toScVal(arg));

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(payload.methodName, ...scArgs))
      .setTimeout(60)
      .build();

    const prepared = await this.executeWithTimeout(
      this.rpc.prepareTransaction(tx as any),
      this.simulateTimeout,
      `prepareTransaction for ${payload.contractId}.${payload.methodName}`,
      signal,
    );

    prepared.sign(keypair);

    const submittedAt = new Date();
    const sendResponse = await this.executeWithTimeout(
      this.rpc.sendTransaction(prepared as any),
      this.sendTimeout,
      `sendTransaction for ${payload.contractId}.${payload.methodName}`,
      signal,
    );

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
      txDetails = await this.getTransaction(txHash, signal);
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

  /**
   * Get transaction with timeout
   * Default timeout: 10 seconds
   */
  async getTransaction(txHash: string, signal?: AbortSignal): Promise<unknown> {
    if (!txHash) {
      throw new BadRequestException('Transaction hash is required');
    }

    return this.executeWithTimeout(
      this.rpc.getTransaction(txHash),
      this.getTransactionTimeout,
      `getTransaction ${txHash}`,
      signal,
    );
  }

  /**
   * Get contract events with timeout
   * Default timeout: 15 seconds
   */
  async getContractEvents(
    contractId: string,
    startLedger: number,
    signal?: AbortSignal,
  ): Promise<any[]> {
    const safeStartLedger = Number.isFinite(startLedger)
      ? Math.max(1, Math.floor(startLedger))
      : 1;

    try {
      const response = await this.executeWithTimeout(
        this.rpc.getEvents({
          startLedger: safeStartLedger,
          filters: [
            {
              type: 'contract',
              contractIds: [contractId],
            },
          ],
        }),
        this.getEventsTimeout,
        `getContractEvents for ${contractId}`,
        signal,
      );

      return response.events || [];
    } catch (error) {
      this.logger.error(
        `Failed to fetch contract events: ${this.getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * Get latest ledger sequence with timeout
   * Default timeout: 10 seconds
   */
  async getLatestLedgerSequence(signal?: AbortSignal): Promise<number> {
    try {
      const latest = await this.executeWithTimeout(
        this.rpc.getLatestLedger(),
        this.getLatestLedgerTimeout,
        'getLatestLedger',
        signal,
      );
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

  /**
   * Execute an operation with timeout and cancellation support
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string,
    signal?: AbortSignal,
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeoutId);
            reject(new Error(`${operationName} cancelled`));
          },
          { once: true },
        );
      }
    });

    return Promise.race([promise, timeoutPromise]);
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
