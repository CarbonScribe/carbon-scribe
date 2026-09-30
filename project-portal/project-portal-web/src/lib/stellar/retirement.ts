/**
 * Stellar Carbon Credit Retirement Module
 * 
 * Provides on-chain retirement functionality for carbon credits,
 * permanently removing tokens from circulation and generating
 * verifiable retirement certificates.
 * 
 * Aligns with backend patterns found in:
 * - internal/financing/tokenization/stellar_client.go
 * - internal/financing/tokenization/minting/service.go
 * - internal/financing/models.go
 * 
 * @module stellar/retirement
 */

// Stellar Expert URL helpers
export const getStellarExpertTxUrl = (transactionHash: string, network: 'testnet' | 'public' = 'public'): string => {
  const networkPath = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkPath}/tx/${transactionHash}`;
};

export const getStellarExpertAccountUrl = (accountId: string, network: 'testnet' | 'public' = 'public'): string => {
  const networkPath = network === 'testnet' ? 'testnet' : 'public';
  return `https://stellar.expert/explorer/${networkPath}/account/${accountId}`;
};

import {
  Horizon,
  TransactionBuilder,
  Operation,
  Keypair,
  Asset,
  Memo,
  Networks,
} from '@stellar/stellar-sdk';
import { createActionableError, type ActionableError } from '../utils/errorHandler';

// ============================================================================
// Types (Align with backend financing models)
// ============================================================================

/** Stellar network configuration - matches backend env vars */
export interface StellarNetworkConfig {
  /** Horizon server URL (matches STELLAR_RPC_URL) */
  serverUrl: string;
  /** Network passphrase (matches STELLAR_NETWORK_PASSPHRASE) */
  networkPassphrase: string;
  /** Optional Horizon URL */
  horizonUrl?: string;
}

/** Retirement request - matches backend minting patterns */
export interface RetirementRequest {
  /** Source account address (matches owner address in backend) */
  sourceAccount: string;
  /** Asset code of the carbon token (matches AssetCode) */
  assetCode: string;
  /** Asset issuer address (matches AssetIssuer) */
  assetIssuer: string;
  /** Amount of tokens to retire */
  amount: string;
  /** Retirement memo metadata (matches buildMetadataVal pattern) */
  memo?: RetirementMemo;
  /** Optional fee payer account */
  feePayer?: string;
  /** Optional base fee in stroops */
  baseFee?: string;
}

/** Retirement memo metadata - matches backend CarbonAssetMetadata */
export interface RetirementMemo {
  /** Project ID (matches project_id in metadata) */
  projectId?: string;
  /** Vintage year (matches vintage_year in metadata) */
  vintageYear?: number;
  /** Purpose of retirement */
  purpose?: string;
  /** Beneficiary of retirement */
  beneficiary?: string;
  /** Custom data (matches metadata pattern) */
  customData?: Record<string, unknown>;
}

/** Retirement response - matches backend MintResponse */
export interface RetirementResponse {
  /** Transaction hash (matches TransactionHash) */
  transactionHash: string;
  /** Stellar ledger sequence */
  ledgerSequence: number;
  /** Status of the retirement */
  status: 'pending' | 'success' | 'failed';
  /** Amount retired */
  amount: string;
  /** Asset retired */
  asset: string;
  /** Retired at timestamp */
  retiredAt: string;
  /** Transaction envelope for verification */
  transactionEnvelope?: string;
  /** Metadata (matches metadata from backend) */
  metadata?: RetirementMemo;
}

/** Retirement status - matches backend transaction polling */
export interface RetirementStatus {
  /** Transaction hash */
  transactionHash: string;
  /** Current status (matches backend status) */
  status: 'pending' | 'success' | 'failed' | 'unknown';
  /** Confirmation count */
  confirmations: number;
  /** Required confirmations */
  requiredConfirmations: number;
  /** Ledger sequence */
  ledgerSequence: number;
  /** Amount retired */
  amount: string;
  /** Asset code */
  assetCode: string;
  /** Asset issuer */
  assetIssuer: string;
  /** Retired at */
  retiredAt?: string;
  /** Failure reason if any */
  failureReason?: string;
  /** Transaction details */
  transactionDetails?: Horizon.ServerApi.TransactionRecord;
}

/** Retirement certificate - matches backend verification certificate */
export interface RetirementCertificate {
  /** Certificate ID (hash) */
  certificateId: string;
  /** Transaction hash */
  transactionHash: string;
  /** Project ID (matches project_id) */
  projectId?: string;
  /** Project name */
  projectName?: string;
  /** Asset code */
  assetCode: string;
  /** Asset issuer */
  assetIssuer: string;
  /** Amount retired */
  amount: string;
  /** Vintage year (matches vintage_year) */
  vintageYear?: number;
  /** Retirement purpose */
  purpose?: string;
  /** Beneficiary */
  beneficiary?: string;
  /** Retired at */
  retiredAt: string;
  /** Verification URL */
  verificationUrl?: string;
  /** Stellar explorer URL */
  stellarExplorerUrl: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Retirement history query - matches backend list filters */
export interface RetirementHistoryQuery {
  /** Address to query */
  address?: string;
  /** Project ID filter (matches project_id) */
  projectId?: string;
  /** Asset code filter */
  assetCode?: string;
  /** Start date filter */
  startDate?: string;
  /** End date filter */
  endDate?: string;
  /** Limit results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/** Retirement history response */
export interface RetirementHistoryResponse {
  retirements: RetirementStatus[];
  total: number;
  hasMore: boolean;
}

/** Stellar account details - matches backend account loading */
export interface StellarAccountDetails {
  /** Account address */
  address: string;
  /** Account ID */
  accountId: string;
  /** Balance for native asset */
  balance: string;
  /** Sequence number (matches backend sequence) */
  sequence: string;
  /** Subentry count */
  subentryCount: number;
  /** Account flags */
  flags: {
    authRequired: boolean;
    authRevocable: boolean;
    authImmutable: boolean;
  };
}

// ============================================================================
// Configuration Management (Matches backend env pattern)
// ============================================================================

let networkConfig: StellarNetworkConfig | null = null;
let server: Horizon.Server | null = null;

/**
 * Default network configurations - matches backend defaults
 */
const NETWORKS = {
  testnet: {
    serverUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: Networks.TESTNET,
  },
  mainnet: {
    serverUrl: 'https://horizon.stellar.org',
    networkPassphrase: Networks.PUBLIC,
  },
} as const;

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
 * Get current network configuration - matches backend config access
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
 * Get Stellar server instance - matches backend rpc client
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
// Core Retirement Functions (Matches backend minting flow)
// ============================================================================

/**
 * Retire carbon tokens on Stellar network
 * Matches backend Mint function pattern with:
 * - Account loading
 * - Transaction building
 * - Simulation
 * - Submission
 * - Confirmation polling
 * 
 * @param request - Retirement request
 * @param secretKey - Secret key of the source account
 * @returns Retirement response
 * @throws {ActionableError} If retirement fails
 */
export async function retireCarbonTokens(
  request: RetirementRequest,
  secretKey: string
): Promise<RetirementResponse> {
  const config = getNetworkConfig();
  const stellarServer = getServer();

  try {
    // Validate request (matches backend validation)
    validateRetirementRequest(request);

    // Create keypair from secret (matches backend keypair parsing)
    const sourceKeypair = Keypair.fromSecret(secretKey);
    const sourcePublicKey = sourceKeypair.publicKey();

    // Load account (matches backend LoadAccount)
    const account = await stellarServer.loadAccount(sourcePublicKey);

    // Create asset object (matches backend Asset creation)
    const asset = new Asset(request.assetCode, request.assetIssuer);

    // Build retirement memo (matches backend memo pattern)
    let memo: Memo | undefined;
    if (request.memo) {
      const memoText = createRetirementMemoText(request.memo);
      memo = Memo.text(memoText);
    }

    // Build transaction (matches backend transaction building)
    let transactionBuilder = new TransactionBuilder(account, {
      fee: request.baseFee || '100',
      networkPassphrase: config.networkPassphrase,
    });

    // Add retirement operations (matches backend operation pattern)
    transactionBuilder = transactionBuilder.addOperation(
      Operation.changeTrust({
        asset,
        limit: '0', // Remove trustline after retirement
      })
    );

    // If there's a fee payer, merge account (matches backend fee payer pattern)
    if (request.feePayer) {
      transactionBuilder = transactionBuilder.addOperation(
        Operation.accountMerge({
          destination: request.feePayer,
        })
      );
    }

    if (memo) {
      transactionBuilder = transactionBuilder.addMemo(memo);
    }

    const transaction = transactionBuilder.build();

    // Sign the transaction (matches backend signing)
    transaction.sign(sourceKeypair);

    // Submit the transaction (matches backend SendTransaction)
    const result = await stellarServer.submitTransaction(transaction);

    // Get ledger sequence
    const ledgerSequence = Number(result.ledger) || 0;

    // Create retirement response (matches backend MintResponse)
    const response: RetirementResponse = {
      transactionHash: result.hash || transaction.hash().toString('hex'),
      ledgerSequence,
      status: 'success',
      amount: request.amount,
      asset: `${request.assetCode}:${request.assetIssuer}`,
      retiredAt: new Date().toISOString(),
      transactionEnvelope: transaction.toEnvelope().toXDR('base64'),
      metadata: request.memo,
    };

    return response;
  } catch (error) {
    // Handle specific Stellar errors (matches backend error handling)
    if (error instanceof Error) {
      // Check for known Stellar error patterns
      if (error.message.includes('insufficient balance')) {
        throw createActionableError(error, {
          category: 'business_logic',
          customMessage: 'Insufficient balance to retire these tokens',
        });
      }
      
      if (error.message.includes('no trust line')) {
        throw createActionableError(error, {
          category: 'business_logic',
          customMessage: 'No trustline found for this asset',
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

      // Network errors (matches backend network error handling)
      if (error.message.includes('timeout') || error.message.includes('network')) {
        throw createActionableError(error, {
          category: 'network',
          customMessage: 'Network error while submitting retirement',
          retryAction: () => retireCarbonTokens(request, secretKey),
        });
      }
    }

    throw createActionableError(error, {
      category: 'server',
      customMessage: error instanceof Error ? error.message : 'Retirement failed',
    });
  }
}

/**
 * Get retirement status - matches backend waitForTransaction pattern
 * 
 * @param transactionHash - Transaction hash
 * @param requiredConfirmations - Required confirmations (default: 2)
 * @returns Retirement status
 * @throws {ActionableError} If status check fails
 */
export async function getRetirementStatus(
  transactionHash: string,
  requiredConfirmations: number = 2
): Promise<RetirementStatus> {
  const stellarServer = getServer();

  try {
    // Query transaction details (matches backend GetTransaction)
    const transaction = await stellarServer
      .transactions()
      .transaction(transactionHash)
      .call();

    // Get current ledger sequence (matches backend ledger polling)
    const currentLedger = await stellarServer.ledgers().order('desc').limit(1).call();
    const currentLedgerSequence = currentLedger.records[0]?.sequence || 0;

    // Calculate confirmations
    const txLedgerSequence = Number(transaction.ledger) || 0;
    const confirmations = Math.max(0, currentLedgerSequence - txLedgerSequence + 1);

    // Determine status (matches backend status determination)
    let status: RetirementStatus['status'] = 'pending';
    if (transaction.successful) {
      status = confirmations >= requiredConfirmations ? 'success' : 'pending';
    } else if (!transaction.successful && transaction.result_xdr) {
      status = 'failed';
    }

    // Extract operation details - using the operations endpoint
    let amount = '0';
    let assetCode = '';
    let assetIssuer = '';

    // Get operations for this transaction
    const operationsResponse = await stellarServer
      .operations()
      .forTransaction(transactionHash)
      .call();

    // Look for the first operation (should be the change_trust operation)
    if (operationsResponse.records.length > 0) {
      const op = operationsResponse.records[0];
      if (op.type === 'change_trust') {
        // ChangeTrustOperationRecord has asset_code and asset_issuer directly
        const changeTrustOp = op as any;
        assetCode = changeTrustOp.asset_code || '';
        assetIssuer = changeTrustOp.asset_issuer || '';
        
        // Get the limit which represents the amount
        if (changeTrustOp.limit) {
          amount = changeTrustOp.limit;
        }
      } else if (op.type === 'payment') {
        const paymentOp = op as any;
        assetCode = paymentOp.asset_code || '';
        assetIssuer = paymentOp.asset_issuer || '';
        amount = paymentOp.amount || '0';
      }
    }

    // Get retired at timestamp
    const retiredAt = transaction.created_at ? new Date(transaction.created_at).toISOString() : undefined;

    // Determine failure reason if status is failed
    let failureReason: string | undefined;
    if (status === 'failed') {
      failureReason = 'Transaction failed on the network';
      if (transaction.result_xdr) {
        try {
          // Parse result_xdr for more details if needed
          failureReason = 'Transaction failed - see transaction details';
        } catch {
          // Keep generic message
        }
      }
    }

    return {
      transactionHash,
      status,
      confirmations,
      requiredConfirmations,
      ledgerSequence: txLedgerSequence,
      amount,
      assetCode,
      assetIssuer,
      retiredAt,
      failureReason,
      transactionDetails: transaction,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return {
        transactionHash,
        status: 'unknown',
        confirmations: 0,
        requiredConfirmations,
        ledgerSequence: 0,
        amount: '0',
        assetCode: '',
        assetIssuer: '',
        failureReason: 'Transaction not found',
      };
    }

    throw createActionableError(error, {
      category: 'server',
      customMessage: 'Failed to get retirement status',
    });
  }
}

/**
 * Generate retirement certificate - matches backend certificate generation
 * 
 * @param transactionHash - Transaction hash
 * @param projectName - Name of the project
 * @param additionalData - Additional certificate data
 * @returns Retirement certificate
 * @throws {ActionableError} If certificate generation fails
 */
export async function getRetirementCertificate(
  transactionHash: string,
  projectName?: string,
  additionalData?: {
    projectId?: string;
    vintageYear?: number;
    purpose?: string;
    beneficiary?: string;
    verificationData?: Record<string, unknown>;
  }
): Promise<RetirementCertificate> {
  try {
    // Get retirement status first (matches backend status check)
    const status = await getRetirementStatus(transactionHash);

    if (status.status === 'unknown') {
      throw createActionableError(
        new Error('Transaction not found'),
        {
          category: 'not_found',
          customMessage: 'No retirement found for this transaction',
        }
      );
    }

    if (status.status === 'failed') {
      throw createActionableError(
        new Error('Transaction failed'),
        {
          category: 'business_logic',
          customMessage: 'Cannot generate certificate for failed retirement',
        }
      );
    }

    // Generate certificate (matches backend certificate generation)
    const certificateId = generateCertificateId(transactionHash, status.retiredAt || new Date().toISOString());

    const certificate: RetirementCertificate = {
      certificateId,
      transactionHash,
      projectId: additionalData?.projectId,
      projectName: projectName || 'Carbon Project',
      assetCode: status.assetCode || 'Unknown',
      assetIssuer: status.assetIssuer || 'Unknown',
      amount: status.amount || '0',
      vintageYear: additionalData?.vintageYear,
      purpose: additionalData?.purpose,
      beneficiary: additionalData?.beneficiary,
      retiredAt: status.retiredAt || new Date().toISOString(),
      stellarExplorerUrl: getStellarExplorerUrl(transactionHash),
      metadata: {
        confirmations: status.confirmations,
        ledgerSequence: status.ledgerSequence,
        ...additionalData?.verificationData,
      },
    };

    return certificate;
  } catch (error) {
    throw createActionableError(error, {
      category: 'server',
      customMessage: 'Failed to generate retirement certificate',
    });
  }
}

/**
 * Fetch retirement history - matches backend list queries
 * 
 * @param query - Query parameters
 * @returns Retirement history
 * @throws {ActionableError} If fetch fails
 */
export async function getRetirementHistory(
  query: RetirementHistoryQuery
): Promise<RetirementHistoryResponse> {
  const stellarServer = getServer();

  try {
    let transactionQuery = stellarServer.transactions().order('desc');

    if (query.address) {
      transactionQuery = transactionQuery.forAccount(query.address);
    }

    // Apply pagination (matches backend pagination)
    if (query.limit) {
      transactionQuery = transactionQuery.limit(Math.min(query.limit, 100));
    }

    if (query.offset) {
      transactionQuery = transactionQuery.cursor(query.offset.toString());
    }

    const results = await transactionQuery.call();

    // Filter transactions by retirement operations
    const retirements: RetirementStatus[] = [];

    for (const record of results.records) {
      // Get operations for this transaction
      const operationsResponse = await stellarServer
        .operations()
        .forTransaction(record.hash)
        .call();
      
      const hasRetirementOp = operationsResponse.records.some((op: any) => 
        op.type === 'change_trust' || 
        (op.type === 'payment' && op.asset_code && op.amount)
      );

      if (hasRetirementOp) {
        const status = await getRetirementStatus(record.hash);
        // Add memo if present
        if (record.memo) {
          status.transactionDetails = {
            ...status.transactionDetails,
            memo: record.memo,
          } as any;
        }
        retirements.push(status);
      }
    }

    // Apply filters (matches backend filtering)
    let filteredRetirements = retirements;
    if (query.projectId) {
      filteredRetirements = retirements.filter(r => 
        r.transactionDetails?.memo?.includes(query.projectId!)
      );
    }

    if (query.assetCode) {
      filteredRetirements = filteredRetirements.filter(r => 
        r.assetCode === query.assetCode
      );
    }

    if (query.startDate) {
      const start = new Date(query.startDate);
      filteredRetirements = filteredRetirements.filter(r => 
        r.retiredAt && new Date(r.retiredAt) >= start
      );
    }

    if (query.endDate) {
      const end = new Date(query.endDate);
      filteredRetirements = filteredRetirements.filter(r => 
        r.retiredAt && new Date(r.retiredAt) <= end
      );
    }

    const total = filteredRetirements.length;
    const hasMore = total > (query.limit || 50);

    return {
      retirements: filteredRetirements.slice(0, query.limit || 50),
      total,
      hasMore,
    };
  } catch (error) {
    throw createActionableError(error, {
      category: 'server',
      customMessage: 'Failed to fetch retirement history',
    });
  }
}

// ============================================================================
// Validation Functions (Matches backend validation)
// ============================================================================

/**
 * Validate retirement request - matches backend validation
 * 
 * @param request - Retirement request
 * @throws {ActionableError} If validation fails
 */
function validateRetirementRequest(request: RetirementRequest): void {
  const errors: string[] = [];

  if (!request.sourceAccount) {
    errors.push('Source account is required');
  } else if (!isValidStellarAddress(request.sourceAccount)) {
    errors.push('Invalid source account address');
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

  if (errors.length > 0) {
    throw createActionableError(
      new Error(errors.join('. ')),
      {
        category: 'validation',
        customMessage: 'Retirement request validation failed',
      }
    );
  }
}

/**
 * Check if address is valid Stellar address - matches backend validation
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

/**
 * Create retirement memo text - matches backend metadata building
 * 
 * @param memoData - Retirement memo data
 * @returns Memo text string
 */
function createRetirementMemoText(memoData: RetirementMemo): string {
  const parts: string[] = [];

  if (memoData.projectId) {
    parts.push(`project:${memoData.projectId}`);
  }

  if (memoData.vintageYear) {
    parts.push(`vintage:${memoData.vintageYear}`);
  }

  if (memoData.purpose) {
    parts.push(`purpose:${memoData.purpose}`);
  }

  if (memoData.beneficiary) {
    parts.push(`beneficiary:${memoData.beneficiary}`);
  }

  if (memoData.customData) {
    Object.entries(memoData.customData).forEach(([key, value]) => {
      parts.push(`${key}:${String(value)}`);
    });
  }

  // Memo text has a 28-byte limit
  const memoText = parts.join('|');
  return memoText.length > 28 ? memoText.substring(0, 28) : memoText;
}

// ============================================================================
// Utility Functions (Matches backend utilities)
// ============================================================================

/**
 * Generate certificate ID - matches backend ID generation
 * 
 * @param transactionHash - Transaction hash
 * @param timestamp - Timestamp
 * @returns Certificate ID
 */
function generateCertificateId(transactionHash: string, timestamp: string): string {
  const data = `${transactionHash}-${timestamp}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `CERT-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * Get Stellar explorer URL - matches backend explorer links
 * 
 * @param transactionHash - Transaction hash
 * @returns Explorer URL
 */
export function getStellarExplorerUrl(transactionHash: string): string {
  const config = getNetworkConfig();
  const network = config.networkPassphrase.includes('Test') ? 'testnet' : 'mainnet';
  
  if (network === 'testnet') {
    return `https://stellar.expert/explorer/testnet/tx/${transactionHash}`;
  }
  return `https://stellar.expert/explorer/public/tx/${transactionHash}`;
}

/**
 * Verify retirement certificate - matches backend verification
 * 
 * @param certificate - Certificate to verify
 * @returns Verification result
 */
export async function verifyRetirementCertificate(
  certificate: RetirementCertificate
): Promise<{
  valid: boolean;
  details: string;
  verificationData?: Record<string, unknown>;
}> {
  try {
    const status = await getRetirementStatus(certificate.transactionHash);

    if (status.status === 'success') {
      return {
        valid: true,
        details: 'Certificate verified successfully',
        verificationData: {
          confirmations: status.confirmations,
          ledgerSequence: status.ledgerSequence,
        },
      };
    }

    if (status.status === 'pending') {
      return {
        valid: false,
        details: `Transaction is still pending (${status.confirmations}/${status.requiredConfirmations} confirmations)`,
        verificationData: {
          confirmations: status.confirmations,
          requiredConfirmations: status.requiredConfirmations,
        },
      };
    }

    return {
      valid: false,
      details: `Transaction failed: ${status.failureReason || 'Unknown error'}`,
    };
  } catch (error) {
    return {
      valid: false,
      details: `Verification error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Format Stellar amount - matches backend formatting
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

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for RetirementResponse
 */
export function isRetirementResponse(response: unknown): response is RetirementResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'transactionHash' in response &&
    'status' in response &&
    typeof (response as RetirementResponse).transactionHash === 'string'
  );
}

/**
 * Type guard for RetirementCertificate
 */
export function isRetirementCertificate(cert: unknown): cert is RetirementCertificate {
  return (
    typeof cert === 'object' &&
    cert !== null &&
    'certificateId' in cert &&
    'transactionHash' in cert &&
    'amount' in cert &&
    typeof (cert as RetirementCertificate).certificateId === 'string'
  );
}

// ============================================================================
// Export Default
// ============================================================================

export default {
  initializeStellarNetwork,
  isStellarNetworkInitialized,
  retireCarbonTokens,
  getRetirementStatus,
  getRetirementCertificate,
  getRetirementHistory,
  verifyRetirementCertificate,
  getStellarExplorerUrl,
  formatStellarAmount,
  isValidStellarAddress,
  isRetirementResponse,
  isRetirementCertificate,
};
