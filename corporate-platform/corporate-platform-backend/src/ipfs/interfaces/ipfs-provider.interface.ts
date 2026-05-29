/**
 * Abstraction interface for IPFS storage providers.
 * Implement this interface to add a new provider (e.g., Infura, Web3.Storage).
 */
export interface IIpfsProvider {
  /**
   * Pin a file to IPFS and return its CID.
   * @param file - The file object (with path, buffer, originalname, mimetype, size).
   * @param metadata - Arbitrary key-value metadata to attach.
   */
  pinFile(file: IpfsFile, metadata: Record<string, unknown>): Promise<string>;

  /**
   * Retrieve content for a given CID.
   * @param cid - The IPFS content identifier.
   */
  getContent(cid: string): Promise<IpfsContent>;

  /**
   * Unpin a CID from the provider.
   * @param cid - The IPFS content identifier.
   */
  unpin(cid: string): Promise<void>;

  /**
   * Pin multiple CIDs in a single batch operation.
   * @param cids - Array of CIDs to pin.
   */
  pinBatch(cids: string[]): Promise<BatchPinResult[]>;

  /** Human-readable name of this provider (e.g., "pinata", "infura"). */
  readonly providerName: string;
}

export interface IpfsFile {
  path?: string;
  buffer?: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface IpfsContent {
  cid: string;
  data?: Buffer | string;
  contentType?: string;
  contentHash?: string;
  integrityVerified?: boolean;
  error?: string;
  details?: unknown;
  expectedHash?: string;
  actualHash?: string;
}

export interface BatchPinResult {
  cid: string;
  success: boolean;
  error?: string;
}

/** Injection token for the active IPFS provider. */
export const IPFS_PROVIDER = 'IPFS_PROVIDER';
