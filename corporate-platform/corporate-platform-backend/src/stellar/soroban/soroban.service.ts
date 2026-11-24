import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  CARBON_ASSET_CONTRACT_ID,
  ContractExecutionResult,
  ContractInvocation,
  ContractSimulation,
  RETIREMENT_TRACKER_CONTRACT_ID,
} from './contracts/contract.interface';
import * as StellarSdk from '@stellar/stellar-sdk';
import { TimeoutError } from '../../shared/exceptions/timeout-error';
import {
  SIGNING_PROVIDER_CONTRACT,
  SigningProvider,
} from '../signing/signing-provider.interface';
import { RequestContext } from '../../logger/context/request-context';

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
  private readonly contractMethodsCache = new Map<
    string,
    { methods: ReadonlySet<string>; expiresAt: number }
  >();
  private readonly contractMethodsLookupInFlight = new Map<
    string,
    Promise<ReadonlySet<string>>
  >();
  private readonly contractMethodsCacheTtlMs = 5 * 60 * 1000;

  // Timeout configurations (in milliseconds)
  private readonly simulateTimeout: number;
  private readonly sendTimeout: number;
  private readonly getTransactionTimeout: number;
  private readonly getEventsTimeout: number;
  private readonly getLatestLedgerTimeout: number;

  /**
   * Delay before a freshly-submitted PENDING call becomes eligible for the
   * reconciliation sweep (#515) — long enough for the RPC to index the
   * transaction, short enough that a late landing is noticed promptly.
   */
  private readonly reconciliationInitialDelayMs = Number(
    process.env.SOROBAN_RECONCILIATION_INITIAL_DELAY_MS || 15_000,
  );

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(SIGNING_PROVIDER_CONTRACT)
    private readonly signingProvider: SigningProvider,
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
    await this.ensureCallInput(payload.contractId, payload.methodName, signal);

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
    await this.ensureCallInput(payload.contractId, payload.methodName, signal);

    const args = payload.args || [];

    // Explicit simulate mode via SigningProvider (never silent missing-env fallback)
    if (!this.signingProvider.isLive()) {
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
      const signingPublicKey = await this.signingProvider.getPublicKey();
      this.logger.log(
        JSON.stringify({
          event: 'contract_invoke_simulated',
          signingPublicKey,
          keyId: this.signingProvider.keyId,
          contractId: payload.contractId,
          methodName: payload.methodName,
          requestId: RequestContext.getRequestId(),
        }),
      );

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

    const signingPublicKey = await this.signingProvider.getPublicKey();
    const sourceAccount = await this.executeWithTimeout(
      this.rpc.getAccount(signingPublicKey),
      this.simulateTimeout,
      `getAccount for ${signingPublicKey}`,
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

    // Sign via SigningProvider — audit log includes public key, not secret
    const preparedXdr = (prepared as any).toXDR();
    const signed = await this.signingProvider.signTransaction(
      preparedXdr,
      this.networkPassphrase,
    );
    this.logger.log(
      JSON.stringify({
        event: 'contract_invoke_signed',
        signingPublicKey: signed.publicKey,
        keyId: signed.keyId ?? this.signingProvider.keyId,
        contractId: payload.contractId,
        methodName: payload.methodName,
        requestId: RequestContext.getRequestId(),
      }),
    );
    const signedTx = StellarSdk.TransactionBuilder.fromXDR(
      signed.signedXdr,
      this.networkPassphrase,
    );

    const submittedAt = new Date();
    const sendResponse = await this.executeWithTimeout(
      this.rpc.sendTransaction(signedTx as any),
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
    let immediateCheckError: string | null = null;

    try {
      txDetails = await this.getTransaction(txHash, signal);
      const txStatus = String((txDetails as any)?.status || '').toUpperCase();
      if (txStatus === 'SUCCESS') {
        status = 'CONFIRMED';
        confirmedAt = new Date();
      }
    } catch (error) {
      immediateCheckError = this.getErrorMessage(error);
      this.logger.warn(
        `Unable to fetch tx ${txHash} immediately after send: ${immediateCheckError}. ` +
          `Row persisted as PENDING; the reconciliation sweep will re-check it.`,
      );
    }

    // A row left PENDING here is picked up by SorobanReconciliationService
    // (#515), which re-checks it on a schedule until the RPC gives a definitive
    // answer or the retry budget is exhausted. Seeding the retry columns —
    // previously modelled but never written by this path — is what makes the
    // row visible to that sweep on its very next tick.
    const isPending = status === 'PENDING';

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
        ...(isPending
          ? {
              retryCount: 0,
              nextRetryAt: new Date(
                Date.now() + this.reconciliationInitialDelayMs,
              ),
              errorMessage: immediateCheckError ?? undefined,
            }
          : {}),
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

  async validateConfiguredContractMethods(): Promise<void> {
    const contracts = [
      {
        contractId:
          process.env.CARBON_ASSET_CONTRACT_ID ||
          process.env.STELLAR_CARBON_ASSET_CONTRACT_ID ||
          CARBON_ASSET_CONTRACT_ID,
        expectedMethods: ['balance', 'mint', 'retire', 'transfer'],
      },
      {
        contractId:
          process.env.RETIREMENT_TRACKER_CONTRACT_ID ||
          process.env.STELLAR_RETIREMENT_TRACKER_CONTRACT_ID ||
          RETIREMENT_TRACKER_CONTRACT_ID,
        expectedMethods: [
          'retire',
          'retire_with_tx_hash',
          'get_retirement_record',
        ],
      },
      {
        contractId:
          process.env.METHODOLOGY_LIBRARY_CONTRACT_ID ||
          'CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP',
        expectedMethods: ['mint_methodology', 'get_methodology_meta'],
      },
    ];

    const missingMethods = (
      await Promise.all(
        contracts.map(async ({ contractId, expectedMethods }) => {
          const methods = await this.getContractMethods(contractId);
          return {
            contractId,
            methods: expectedMethods.filter((method) => !methods.has(method)),
          };
        }),
      )
    ).filter(({ methods }) => methods.length > 0);

    if (missingMethods.length > 0) {
      const details = missingMethods
        .map(
          ({ contractId, methods }) =>
            `"${contractId}" is missing ${methods.join(', ')}`,
        )
        .join('; ');
      throw new Error(`Soroban contract method validation failed: ${details}`);
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
    let timeoutId: NodeJS.Timeout;
    let abortHandler: (() => void) | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new TimeoutError(`${operationName} timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);

      if (signal) {
        if (signal.aborted) {
          clearTimeout(timeoutId);
          reject(new Error(`${operationName} cancelled`));
          return;
        }
        abortHandler = () => {
          clearTimeout(timeoutId);
          reject(new Error(`${operationName} cancelled`));
        };
        signal.addEventListener('abort', abortHandler, { once: true });
      }
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId);
      if (signal && abortHandler) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
  }

  private async ensureCallInput(
    contractId: string,
    methodName: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!contractId || !contractId.trim()) {
      throw new BadRequestException('contractId is required');
    }
    if (!methodName || !methodName.trim()) {
      throw new BadRequestException('methodName is required');
    }

    let methods: ReadonlySet<string>;
    try {
      methods = await this.executeWithTimeout(
        this.getContractMethods(contractId),
        this.simulateTimeout,
        `getContractMethods for ${contractId}`,
        signal,
      );
    } catch (error) {
      throw new InternalServerErrorException(
        `Unable to validate method "${methodName}" for contract "${contractId}": ${this.getErrorMessage(error)}`,
      );
    }

    if (!methods.has(methodName)) {
      throw new BadRequestException(
        `Method "${methodName}" is not exposed by contract "${contractId}"`,
      );
    }
  }

  private async getContractMethods(
    contractId: string,
  ): Promise<ReadonlySet<string>> {
    const cached = this.contractMethodsCache.get(contractId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.methods;
    }
    if (cached) {
      this.contractMethodsCache.delete(contractId);
    }

    const inFlight = this.contractMethodsLookupInFlight.get(contractId);
    if (inFlight) {
      return inFlight;
    }

    const lookup = (async () => {
      const wasm = await this.rpc.getContractWasmByContractId(contractId);
      const methods = new Set(
        StellarSdk.contract.Spec.fromWasm(wasm)
          .funcs()
          .map((func) => func.name().toString()),
      );
      this.contractMethodsCache.set(contractId, {
        methods,
        expiresAt: Date.now() + this.contractMethodsCacheTtlMs,
      });
      return methods;
    })();

    this.contractMethodsLookupInFlight.set(contractId, lookup);
    try {
      return await lookup;
    } finally {
      if (this.contractMethodsLookupInFlight.get(contractId) === lookup) {
        this.contractMethodsLookupInFlight.delete(contractId);
      }
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
