/**
 * Stellar Carbon Tokens Module
 * 
 * Provides functions for querying and transferring carbon tokens on the
 * Stellar network. Handles token balances, asset information, and
 * transaction history for Stellar-based carbon assets.
 * 
 * Aligns with backend patterns found in:
 * - internal/financing/tokenization/stellar_client.go
 * - internal/financing/tokenization/minting/service.go
 * - internal/financing/models.go
 * 
 * @module stellar/carbonTokens
 */

import {
  Horizon,
  Keypair,
  Asset,
  TransactionBuilder,
  Operation,
  Memo,
  Networks,
  NotFoundError,
} from '@stellar/stellar-sdk';
import { createActionableError } from '../utils/errorHandler';

// ============================================================================
// Types (Align with backend financing models)
// ============================================================================

/** Stellar network configuration - matches backend env vars */
interface StellarNetworkConfig {
  /** Horizon server URL (matches STELLAR_RPC_URL) */
  serverUrl: string;
  /** Network passphrase (matches STELLAR_NETWORK_PASSPHRASE) */
  networkPassphrase: string;
  /** Optional Horizon URL */
  horizonUrl?: string;
}

/** Carbon token information - matches backend CarbonCredit model */
export interface CarbonTokenInfo {
  /** Asset code (matches StellarAssetCode) */
  assetCode: string;
  /** Asset issuer address (matches StellarAssetIssuer) */
  assetIssuer: string;
  /** Total supply of the token */
  supply: string;
  /** Number of holders */
  holders: number;
  /** Domain of the issuer */
  domain?: string;
  /** Trustline limit */
  limit?: string;
  /** Whether the asset is authorized */
  authorized?: boolean;
  /** Asset type (native or custom) */
  assetType: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  /** Additional metadata from the asset */
  metadata?: Record<string, unknown>;
}

/** Token balance response - matches backend balance queries */
export interface TokenBalance {
  /** Asset code */
  assetCode: string;
  /** Asset issuer */
  assetIssuer: string;
  /** Balance amount */
  balance: string;
  /** Balance in human-readable format */
  formattedBalance: string;
  /** Trustline limit (if applicable) */
  limit?: string;
  /** Whether the trustline is authorized */
  authorized?: boolean;
  /** Balance in base units (stroops) */
  baseBalance: string;
}

/** Token transfer request - matches backend transfer patterns */
export interface TransferTokensRequest {
  /** Source account address */
  sourceAccount: string;
  /** Destination account address */
  destinationAccount: string;
  /** Asset code to transfer */
  assetCode: string;
  /** Asset issuer address */
  assetIssuer: string;
  /** Amount to transfer */
  amount: string;
  /** Optional memo for the transfer */
  memo?: string;
  /** Optional base fee in stroops */
  baseFee?: string;
}

/** Token transfer response - matches backend transaction response */
export interface TransferTokensResponse {
  /** Transaction hash */
  transactionHash: string;
  /** Ledger sequence */
  ledgerSequence: number;
  /** Amount transferred */
  amount: string;
  /** Asset transferred */
  asset: string;
  /** Source account */
  sourceAccount: string;
  /** Destination account */
  destinationAccount: string;
  /** Transfer timestamp */
  transferredAt: string;
  /** Transaction status */
  status: 'success' | 'failed' | 'pending';
}

/** Token history query - matches backend transaction queries */
export interface TokenHistoryQuery {
  /** Account address to query */
  address?: string;
  /** Asset code filter */
  assetCode?: string;
  /** Asset issuer filter */
  assetIssuer?: string;
  /** Start date filter */
  startDate?: string;
  /** End date filter */
  endDate?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Transaction type filter */
  operationType?: 'payment' | 'change_trust' | 'all';
}

/** Token history response */
export interface TokenHistoryResponse {
  transactions: TokenHistoryEntry[];
  total: number;
  hasMore: boolean;
}

/** Token history entry */
export interface TokenHistoryEntry {
  /** Transaction hash */
  transactionHash: string;
  /** Transaction type */
  type: 'payment' | 'change_trust' | 'other';
  /** Asset code */
  assetCode: string;
  /** Asset issuer */
  assetIssuer: string;
  /** Amount */
  amount: string;
  /** Source account */
  sourceAccount: string;
  /** Destination account */
  destinationAccount?: string;
  /** Transaction timestamp */
  timestamp: string;
  /** Memo text */
  memo?: string;
  /** Transaction status */
  status: 'success' | 'failed' | 'pending';
  /** Additional details */
  details?: Record<string, unknown>;
}

/** Trustline status */
export interface TrustlineStatus {
  /** Asset code */
  assetCode: string;
  /** Asset issuer */
  assetIssuer: string;
  /** Whether the trustline exists */
  exists: boolean;
  /** Trustline limit */
  limit?: string;
  /** Balance in the trustline */
  balance?: string;
  /** Whether the trustline is authorized */
  authorized?: boolean;
}

// ============================================================================
// Configuration Management (Shared with retirement.ts)
// ============================================================================

let networkConfig: StellarNetworkConfig | null = null;
let server: Horizon.Server | null = null;

/**
 * Initialize Stellar network - matches backend NewClientFromEnv pattern
 * 
 * @param config - Stellar network configuration
 * @throws {ActionableError} If configuration is invalid
 */
export function initializeStellarNetwork(config: StellarNetworkConfig): void {
  if (!config.serverUrl || !config.networkPassphrase) {
    throw createActionableError(
      new Error('Stellar network configuration incomplete'),
      {
        category: 'validation',
        customMessage: 'Missing required Stellar network configuration',
      }
    );
  }

  networkConfig = config;
  server = new Horizon.Server(config.serverUrl);
}

/**
 * Get current network configuration
 */
function getNetworkConfig(): StellarNetworkConfig {
  if (!networkConfig) {
    throw createActionableError(
      new Error('Stellar network not initialized'),
      {
        category: 'validation',
        customMessage: 'Initialize Stellar network before making transactions',
      }
    );
  }
  return networkConfig;
}

/**
 * Get Stellar server instance
 */
function getServer(): Horizon.Server {
  if (!server) {
    throw createActionableError(
      new Error('Stellar server not initialized'),
      {
        category: 'validation',
        customMessage: 'Initialize Stellar network before making transactions',
      }
    );
  }
  return server;
}

/**
 * Check if Stellar network is initialized
 */
export function isStellarNetworkInitialized(): boolean {
  return networkConfig !== null && server !== null;
}

// ============================================================================
// Core Token Functions (Matches backend token operations)
// ============================================================================

/**
 * Get carbon token balance for a given address and asset
 * Matches backend balance queries and account loading
 * 
 * @param address - Stellar address to query
 * @param assetCode - Asset code (optional, returns all balances if not specified)
 * @param assetIssuer - Asset issuer (required if assetCode is specified)
 * @returns Token balance or array of balances
 * @throws {ActionableError} If balance query fails
 */
export async function getCarbonTokenBalance(
  address: string,
  assetCode?: string,
  assetIssuer?: string
): Promise<TokenBalance | TokenBalance[]> {
  const stellarServer = getServer();

  try {
    // Validate address (matches backend validation)
    if (!isValidStellarAddress(address)) {
      throw createActionableError(
        new Error('Invalid Stellar address'),
        {
          category: 'validation',
          customMessage: 'Invalid Stellar address format',
        }
      );
    }

    // Load account (matches backend LoadAccount)
    const account = await stellarServer.loadAccount(address);

    // Get all balances
    const balances = account.balances as any[];

    // If specific asset requested
    if (assetCode) {
      if (!assetIssuer) {
        throw createActionableError(
          new Error('Asset issuer required when querying specific asset'),
          {
            category: 'validation',
            customMessage: 'Asset issuer must be provided with asset code',
          }
        );
      }

      // Find balance for specific asset
      const balance = balances.find(b => 
        b.asset_code === assetCode && b.asset_issuer === assetIssuer
      );

      if (!balance) {
        return {
          assetCode,
          assetIssuer,
          balance: '0',
          formattedBalance: '0',
          baseBalance: '0',
          authorized: false,
        };
      }

      return {
        assetCode: balance.asset_code,
        assetIssuer: balance.asset_issuer,
        balance: balance.balance,
        formattedBalance: formatStellarAmount(balance.balance),
        limit: balance.limit,
        authorized: balance.is_authorized !== false,
        baseBalance: balance.balance,
      };
    }

    // Return all balances (filter out native asset)
    const tokenBalances: TokenBalance[] = balances
      .filter(b => b.asset_type !== 'native')
      .map(b => ({
        assetCode: b.asset_code,
        assetIssuer: b.asset_issuer,
        balance: b.balance,
        formattedBalance: formatStellarAmount(b.balance),
        limit: b.limit,
        authorized: b.is_authorized !== false,
        baseBalance: b.balance,
      }));

    return tokenBalances;
  } catch (error) {
    if (error instanceof NotFoundError) {
      // Account not found - return empty balances
      if (assetCode && assetIssuer) {
        return {
          assetCode,
          assetIssuer,
          balance: '0',
          formattedBalance: '0',
          baseBalance: '0',
          authorized: false,
        };
      }
      return [];
    }

    throw createActionableError(error, {
      category: 'server',
      customMessage: 'Failed to get token balance',
    });
  }
}

/**
 * Transfer carbon tokens between Stellar accounts
 * Matches backend transfer/payment patterns
 * 
 * @param request - Transfer request
 * @param secretKey - Secret key of the source account
 * @returns Transfer response
 * @throws {ActionableError} If transfer fails
 */
export async function transferCarbonTokens(
  request: TransferTokensRequest,
  secretKey: string
): Promise<TransferTokensResponse> {
  const config = getNetworkConfig();
  const stellarServer = getServer();

  try {
    // Validate request (matches backend validation)
    validateTransferRequest(request);

    // Create keypair from secret (matches backend keypair parsing)
    const sourceKeypair = Keypair.fromSecret(secretKey);
    const sourcePublicKey = sourceKeypair.publicKey();

    // Validate source account matches request
    if (sourcePublicKey !== request.sourceAccount) {
      throw createActionableError(
        new Error('Source account mismatch'),
        {
          category: 'validation',
          customMessage: 'Secret key does not match source account',
        }
      );
    }

    // Load account (matches backend LoadAccount)
    const account = await stellarServer.loadAccount(request.sourceAccount);

    // Create asset object (matches backend Asset creation)
    const asset = new Asset(request.assetCode, request.assetIssuer);

    // Create memo if provided (matches backend memo pattern)
    const memo = request.memo ? Memo.text(request.memo) : Memo.text('Carbon token transfer');

    // Build transaction (matches backend transaction building)
    let transactionBuilder = new TransactionBuilder(account, {
      fee: request.baseFee || '100',
      networkPassphrase: config.networkPassphrase,
    });

    // Add payment operation (matches backend payment operation)
    transactionBuilder = transactionBuilder.addOperation(
      Operation.payment({
        destination: request.destinationAccount,
        asset,
        amount: request.amount,
      })
    );

    transactionBuilder = transactionBuilder.addMemo(memo);
    const transaction = transactionBuilder.build();

    // Sign the transaction (matches backend signing)
    transaction.sign(sourceKeypair);

    // Submit the transaction (matches backend SendTransaction)
    const result = await stellarServer.submitTransaction(transaction);

    // Get ledger sequence
    const ledgerSequence = Number(result.ledger) || 0;

    return {
      transactionHash: result.hash || transaction.hash().toString('hex'),
      ledgerSequence,
      amount: request.amount,
      asset: `${request.assetCode}:${request.assetIssuer}`,
      sourceAccount: request.sourceAccount,
      destinationAccount: request.destinationAccount,
      transferredAt: new Date().toISOString(),
      status: 'success',
    };
  } catch (error) {
    // Handle specific Stellar errors (matches backend error handling)
    if (error instanceof Error) {
      if (error.message.includes('insufficient balance')) {
        throw createActionableError(error, {
          category: 'business_logic',
          customMessage: 'Insufficient balance for transfer',
        });
      }

      if (error.message.includes('no trust line')) {
        throw createActionableError(error, {
          category: 'business_logic',
          customMessage: 'Destination account has no trustline for this asset',
        });
      }

      if (error.message.includes('invalid asset')) {
        throw createActionableError(error, {
          category: 'validation',
          customMessage: 'Invalid asset code or issuer',
        });
      }

      if (error.message.includes('bad sequence')) {
        throw createActionableError(error, {
          category: 'validation',
          customMessage: 'Transaction sequence error',
        });
      }

      if (error.message.includes('timeout') || error.message.includes('network')) {
        throw createActionableError(error, {
          category: 'network',
          customMessage: 'Network error while transferring tokens',
          retryAction: () => transferCarbonTokens(request, secretKey),
        });
      }
    }

    throw createActionableError(error, {
      category: 'server',
      customMessage: error instanceof Error ? error.message : 'Transfer failed',
    });
  }
}

/**
 * Get carbon token information (asset details)
 * Matches backend asset queries
 * 
 * @param assetCode - Asset code
 * @param assetIssuer - Asset issuer address
 * @returns Carbon token information
 * @throws {ActionableError} If asset query fails
 */
export async function getCarbonTokenInfo(
  assetCode: string,
  assetIssuer: string
): Promise<CarbonTokenInfo> {
  const stellarServer = getServer();

  try {
    // Validate parameters
    if (!assetCode || !assetIssuer) {
      throw createActionableError(
        new Error('Asset code and issuer are required'),
        {
          category: 'validation',
          customMessage: 'Asset code and issuer must be provided',
        }
      );
    }

    // Query asset details (matches backend asset queries)
    const assets = await stellarServer.assets().forCode(assetCode).call();

    // Find matching asset
    let assetRecord: any = null;
    for (const record of assets.records) {
      if (record.asset_issuer === assetIssuer) {
        assetRecord = record;
        break;
      }
    }

    if (!assetRecord) {
      throw createActionableError(
        new Error('Asset not found'),
        {
          category: 'not_found',
          customMessage: `Asset ${assetCode}:${assetIssuer} not found on the network`,
        }
      );
    }

    // Get additional metadata from the asset
    const metadata = await getAssetMetadata(assetCode, assetIssuer);

    return {
      assetCode: assetRecord.asset_code,
      assetIssuer: assetRecord.asset_issuer,
      supply: assetRecord.amount || '0',
      holders: assetRecord.num_holders || 0,
      domain: assetRecord.domain || undefined,
      limit: assetRecord.limit || undefined,
      authorized: assetRecord.authorized,
      assetType: assetRecord.asset_type || 'credit_alphanum4',
      metadata,
    };
  } catch (error) {
    // Re-throw ActionableError as-is
    if (error instanceof Error && 'category' in error) {
      throw error;
    }

    throw createActionableError(error, {
      category: 'server',
      customMessage: 'Failed to get token information',
    });
  }
}

/**
 * Get token transaction history
 * Matches backend transaction history queries
 * 
 * @param query - History query parameters
 * @returns Token history response
 * @throws {ActionableError} If history query fails
 */
export async function getTokenHistory(
  query: TokenHistoryQuery
): Promise<TokenHistoryResponse> {
  const stellarServer = getServer();

  try {
    let operationQuery = stellarServer.operations().order('desc');

    if (query.address) {
      operationQuery = operationQuery.forAccount(query.address);
    }

    // Apply pagination
    if (query.limit) {
      operationQuery = operationQuery.limit(Math.min(query.limit, 100));
    }

    if (query.offset) {
      operationQuery = operationQuery.cursor(query.offset.toString());
    }

    const results = await operationQuery.call();

    // Filter and transform operations
    const transactions: TokenHistoryEntry[] = [];
    let total = 0;

    for (const record of results.records) {
      // Filter by asset if specified
      if (query.assetCode && query.assetIssuer) {
        const opAsset = (record as any).asset;
        if (opAsset) {
          const [code, issuer] = opAsset.split(':');
          if (code !== query.assetCode || issuer !== query.assetIssuer) {
            continue;
          }
        }
      }

      // Filter by operation type
      if (query.operationType && query.operationType !== 'all') {
        const opType = (record as any).type;
        if (query.operationType === 'payment' && opType !== 'payment') {
          continue;
        }
        if (query.operationType === 'change_trust' && opType !== 'change_trust') {
          continue;
        }
      }

      // Transform to history entry
      const entry = await transformOperationToHistory(record);
      if (entry) {
        transactions.push(entry);
        total++;
      }
    }

    const hasMore = transactions.length > (query.limit || 50);

    return {
      transactions: transactions.slice(0, query.limit || 50),
      total,
      hasMore,
    };
  } catch (error) {
    throw createActionableError(error, {
      category: 'server',
      customMessage: 'Failed to get token history',
    });
  }
}

/**
 * Check trustline status for an asset
 * Matches backend trustline validation
 * 
 * @param address - Account address
 * @param assetCode - Asset code
 * @param assetIssuer - Asset issuer
 * @returns Trustline status
 * @throws {ActionableError} If check fails
 */
export async function checkTrustline(
  address: string,
  assetCode: string,
  assetIssuer: string
): Promise<TrustlineStatus> {
  const stellarServer = getServer();

  try {
    // Validate address
    if (!isValidStellarAddress(address)) {
      throw createActionableError(
        new Error('Invalid Stellar address'),
        {
          category: 'validation',
          customMessage: 'Invalid Stellar address format',
        }
      );
    }

    // Load account
    const account = await stellarServer.loadAccount(address);
    const balances = account.balances as any[];

    // Find trustline for the asset
    const trustline = balances.find(b => 
      b.asset_code === assetCode && b.asset_issuer === assetIssuer
    );

    if (trustline) {
      return {
        assetCode,
        assetIssuer,
        exists: true,
        limit: trustline.limit,
        balance: trustline.balance,
        authorized: trustline.is_authorized !== false,
      };
    }

    return {
      assetCode,
      assetIssuer,
      exists: false,
      authorized: false,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return {
        assetCode,
        assetIssuer,
        exists: false,
        authorized: false,
      };
    }

    throw createActionableError(error, {
      category: 'server',
      customMessage: 'Failed to check trustline',
    });
  }
}

// ============================================================================
// Helper Functions (Matches backend helper patterns)
// ============================================================================

/**
 * Transform operation record to history entry
 * 
 * @param record - Operation record from Stellar
 * @returns Token history entry
 */
async function transformOperationToHistory(
  record: any
): Promise<TokenHistoryEntry | null> {
  try {
    let type: TokenHistoryEntry['type'] = 'other';
    let assetCode = '';
    let assetIssuer = '';
    let amount = '0';
    let sourceAccount = '';
    let destinationAccount = '';

    if (record.type === 'payment') {
      type = 'payment';
      // For payment operations, asset may be a string like "CODE:ISSUER"
      const assetMatch = record.asset?.match(/(.+):(.+)/);
      if (assetMatch) {
        assetCode = assetMatch[1];
        assetIssuer = assetMatch[2];
      } else if (record.asset_code) {
        // Some versions have separate fields
        assetCode = record.asset_code;
        assetIssuer = record.asset_issuer || '';
      }
      amount = record.amount || '0';
      sourceAccount = record.source_account;
      destinationAccount = record.to;
    } else if (record.type === 'change_trust') {
      type = 'change_trust';
      // Change trust has asset_code and asset_issuer directly
      assetCode = record.asset_code || '';
      assetIssuer = record.asset_issuer || '';
      amount = record.limit || '0';
      sourceAccount = record.account;
    }

    // Get transaction details for memo
    const tx = await getTransaction(record.transaction_hash);
    const memo = tx?.memo_type !== 'none' ? tx?.memo : undefined;

    return {
      transactionHash: record.transaction_hash,
      type,
      assetCode,
      assetIssuer,
      amount,
      sourceAccount,
      destinationAccount,
      timestamp: record.created_at,
      memo,
      status: record.transaction_successful ? 'success' : 'failed',
      details: {
        operationId: record.id,
        operationType: record.type,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Get transaction details
 * 
 * @param hash - Transaction hash
 * @returns Transaction record
 */
async function getTransaction(hash: string): Promise<any> {
  const stellarServer = getServer();
  try {
    return await stellarServer.transactions().transaction(hash).call();
  } catch {
    return null;
  }
}

/**
 * Get asset metadata
 * 
 * @param assetCode - Asset code
 * @param assetIssuer - Asset issuer
 * @returns Asset metadata
 */
async function getAssetMetadata(
  assetCode: string,
  assetIssuer: string
): Promise<Record<string, unknown>> {
  // This could query IPFS or other sources for asset metadata
  // For now, return basic info
  return {
    code: assetCode,
    issuer: assetIssuer,
    type: 'carbon_credit',
  };
}

// ============================================================================
// Validation Functions (Matches backend validation)
// ============================================================================

/**
 * Validate transfer request
 * 
 * @param request - Transfer request
 * @throws {ActionableError} If validation fails
 */
function validateTransferRequest(request: TransferTokensRequest): void {
  const errors: string[] = [];

  if (!request.sourceAccount) {
    errors.push('Source account is required');
  } else if (!isValidStellarAddress(request.sourceAccount)) {
    errors.push('Invalid source account address');
  }

  if (!request.destinationAccount) {
    errors.push('Destination account is required');
  } else if (!isValidStellarAddress(request.destinationAccount)) {
    errors.push('Invalid destination account address');
  }

  if (!request.assetCode) {
    errors.push('Asset code is required');
  } else if (!/^[A-Za-z0-9]{1,12}$/.test(request.assetCode)) {
    errors.push('Invalid asset code (must be 1-12 alphanumeric characters)');
  }

  if (!request.assetIssuer) {
    errors.push('Asset issuer is required');
  } else if (!isValidStellarAddress(request.assetIssuer)) {
    errors.push('Invalid asset issuer address');
  }

  if (!request.amount) {
    errors.push('Amount is required');
  } else if (isNaN(Number(request.amount)) || Number(request.amount) <= 0) {
    errors.push('Amount must be a positive number');
  }

  if (request.sourceAccount === request.destinationAccount) {
    errors.push('Source and destination accounts cannot be the same');
  }

  if (errors.length > 0) {
    throw createActionableError(
      new Error(errors.join('. ')),
      {
        category: 'validation',
        customMessage: 'Transfer request validation failed',
      }
    );
  }
}

/**
 * Check if address is valid Stellar address
 * 
 * @param address - Address to check
 * @returns Whether the address is valid
 */
export function isValidStellarAddress(address: string): boolean {
  try {
    Keypair.fromPublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Utility Functions (Matches backend utilities)
// ============================================================================

/**
 * Format Stellar amount
 * 
 * @param amount - Amount in stroops
 * @param decimals - Number of decimal places (default: 7)
 * @returns Formatted amount
 */
export function formatStellarAmount(amount: string, decimals: number = 7): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return num.toFixed(decimals);
}

/**
 * Convert amount to base units (stroops)
 * 
 * @param amount - Amount in units
 * @param decimals - Number of decimal places (default: 7)
 * @returns Amount in stroops
 */
export function toStroops(amount: string, decimals: number = 7): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return (num * Math.pow(10, decimals)).toString();
}

/**
 * Convert from stroops to units
 * 
 * @param stroops - Amount in stroops
 * @param decimals - Number of decimal places (default: 7)
 * @returns Amount in units
 */
export function fromStroops(stroops: string, decimals: number = 7): string {
  const num = parseFloat(stroops);
  if (isNaN(num)) return '0';
  return (num / Math.pow(10, decimals)).toString();
}

/**
 * Check if asset is native (XLM)
 * 
 * @param assetCode - Asset code
 * @returns Whether the asset is native
 */
export function isNativeAsset(assetCode: string): boolean {
  return assetCode === 'XLM' || assetCode === 'native' || assetCode === '';
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TokenBalance
 */
export function isTokenBalance(balance: unknown): balance is TokenBalance {
  return (
    typeof balance === 'object' &&
    balance !== null &&
    'assetCode' in balance &&
    'balance' in balance &&
    typeof (balance as TokenBalance).assetCode === 'string'
  );
}

/**
 * Type guard for CarbonTokenInfo
 */
export function isCarbonTokenInfo(info: unknown): info is CarbonTokenInfo {
  return (
    typeof info === 'object' &&
    info !== null &&
    'assetCode' in info &&
    'assetIssuer' in info &&
    'supply' in info &&
    typeof (info as CarbonTokenInfo).assetCode === 'string'
  );
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  initializeStellarNetwork,
  isStellarNetworkInitialized,
  getCarbonTokenBalance,
  transferCarbonTokens,
  getCarbonTokenInfo,
  getTokenHistory,
  checkTrustline,
  isValidStellarAddress,
  formatStellarAmount,
  toStroops,
  fromStroops,
  isNativeAsset,
  isTokenBalance,
  isCarbonTokenInfo,
};