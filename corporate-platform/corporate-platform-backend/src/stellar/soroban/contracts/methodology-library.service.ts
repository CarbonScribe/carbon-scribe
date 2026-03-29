import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../../config/config.service';
import * as StellarSdk from '@stellar/stellar-sdk';
import { nativeToScVal } from '@stellar/stellar-sdk';

export interface MethodologyMeta {
  name: string;
  version: string;
  registry: string;
  registryLink: string;
  issuingAuthority: string;
  ipfsCid?: string | null;
}

@Injectable()
export class MethodologyLibraryService {
  private readonly logger = new Logger(MethodologyLibraryService.name);
  private readonly rpc: StellarSdk.rpc.Server;
  private readonly networkPassphrase: string;
  private readonly contractId: string;

  constructor(private readonly configService: ConfigService) {
    const stellarConfig = this.configService.getStellarConfig();
    this.rpc = new StellarSdk.rpc.Server(
      stellarConfig.sorobanRpcUrl || 'https://soroban-testnet.stellar.org',
    );

    this.networkPassphrase =
      stellarConfig.network === 'public'
        ? StellarSdk.Networks.PUBLIC
        : StellarSdk.Networks.TESTNET;

    this.contractId =
      process.env.METHODOLOGY_LIBRARY_CONTRACT_ID ||
      'CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP';
  }

  async getLatestTokenId(): Promise<number> {
    if (process.env.METHODOLOGY_LIBRARY_MAX_TOKEN_ID) {
      const fromEnv = Number(process.env.METHODOLOGY_LIBRARY_MAX_TOKEN_ID);
      if (Number.isInteger(fromEnv) && fromEnv >= 0) {
        return fromEnv;
      }
    }

    const methods = [
      'get_last_token_id',
      'last_token_id',
      'token_count',
      'total_supply',
      'next_token_id',
    ];

    for (const method of methods) {
      try {
        const value = await this.invokeReadonly(method);
        const tokenId = this.asInteger(value);
        if (tokenId !== null) {
          return tokenId;
        }
      } catch (error) {
        this.logger.debug(
          `Contract method ${method} not available for token count: ${error.message}`,
        );
      }
    }

    return 0;
  }

  async getCurrentLedgerSequence(): Promise<number> {
    try {
      const latest = await (this.rpc as any).getLatestLedger();
      return Number(latest?.sequence || 0);
    } catch {
      return 0;
    }
  }

  async getMethodologyMeta(tokenId: number): Promise<MethodologyMeta | null> {
    const methods = [
      'get_methodology_meta',
      'get_methodology',
      'methodology_meta',
      'methodology',
    ];

    for (const method of methods) {
      try {
        const payload = await this.invokeReadonly(method, [
          nativeToScVal(tokenId, { type: 'u32' }),
        ]);

        const normalized = this.normalizeMethodologyMeta(payload);
        if (normalized) {
          return normalized;
        }
      } catch (error) {
        this.logger.debug(
          `Contract method ${method} failed for token ${tokenId}: ${error.message}`,
        );
      }
    }

    return null;
  }

  private async invokeReadonly(method: string, args: any[] = []): Promise<any> {
    const sourceAddress =
      process.env.METHODOLOGY_LIBRARY_SIM_SOURCE ||
      StellarSdk.Keypair.random().publicKey();

    const sourceAccount = new StellarSdk.Account(sourceAddress, '0');
    const contract = new StellarSdk.Contract(this.contractId);

    const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const simulated = await this.rpc.simulateTransaction(tx as any);
    const retval =
      (simulated as any)?.result?.retval ??
      (simulated as any)?.retval ??
      (simulated as any)?.results?.[0]?.retval;

    if (!retval) {
      return null;
    }

    const scVal =
      typeof retval === 'string'
        ? StellarSdk.xdr.ScVal.fromXDR(retval, 'base64')
        : retval;

    return StellarSdk.scValToNative(scVal);
  }

  private normalizeMethodologyMeta(payload: any): MethodologyMeta | null {
    if (!payload) {
      return null;
    }

    if (Array.isArray(payload) && payload.length >= 5) {
      return {
        name: String(payload[0] || '').trim(),
        version: String(payload[1] || '').trim(),
        registry: String(payload[2] || '').trim(),
        registryLink: String(payload[3] || '').trim(),
        issuingAuthority: String(payload[4] || '').trim(),
        ipfsCid:
          payload.length > 5 && payload[5] != null
            ? String(payload[5]).trim()
            : null,
      };
    }

    const obj = this.toPlainObject(payload);

    const result: MethodologyMeta = {
      name: this.pickString(obj, ['name']),
      version: this.pickString(obj, ['version']),
      registry: this.pickString(obj, ['registry']),
      registryLink: this.pickString(obj, ['registry_link', 'registryLink']),
      issuingAuthority: this.pickString(obj, [
        'issuing_authority',
        'issuingAuthority',
      ]),
      ipfsCid:
        this.pickOptionalString(obj, ['ipfs_cid', 'ipfsCid']) || undefined,
    };

    if (!result.name || !result.version || !result.registry) {
      return null;
    }

    return result;
  }

  private toPlainObject(value: any): Record<string, any> {
    if (value instanceof Map) {
      return Object.fromEntries(value.entries());
    }

    if (typeof value === 'object' && value !== null) {
      return value;
    }

    return {};
  }

  private pickString(obj: Record<string, any>, keys: string[]): string {
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null) {
        return String(value).trim();
      }
    }

    return '';
  }

  private pickOptionalString(
    obj: Record<string, any>,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }

    return null;
  }

  private asInteger(value: any): number | null {
    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.floor(value);
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.floor(parsed) : null;
    }

    return null;
  }
}
