import { Injectable, Logger } from '@nestjs/common';
import * as FormData from 'form-data';
import axios, { AxiosError } from 'axios';
import { createReadStream } from 'fs';
import {
  IIpfsProvider,
  IpfsFile,
  IpfsContent,
  BatchPinResult,
} from '../interfaces/ipfs-provider.interface';
import { IpfsConfig } from '../ipfs.config';

interface RetryableAxiosError extends AxiosError {
  code?: string;
}

/**
 * Pinata implementation of IIpfsProvider.
 * All Pinata-specific logic is isolated here; swap this class to change providers.
 */
@Injectable()
export class PinataProvider implements IIpfsProvider {
  readonly providerName = 'pinata';
  private readonly logger = new Logger(PinataProvider.name);
  private readonly base = 'https://api.pinata.cloud';

  constructor(private readonly config: IpfsConfig) {}

  private get authHeaders() {
    return { Authorization: `Bearer ${this.config.jwt}` };
  }

  private isRetryableError(err: RetryableAxiosError): boolean {
    const status = err.response?.status;

    // Client errors (4xx) are NOT retryable except rate-limit / timeout-like cases
    if (status && status >= 400 && status < 500) {
      // 429 Too Many Requests is retryable
      if (status === 429) return true;
      // Axios timeout is surfaced as ECONNABORTED in the error code
      if (err.code === 'ECONNABORTED') return true;
      // Other 4xx are client errors and should not be retried
      return false;
    }

    // Server errors (5xx), network errors, timeouts, and unknown errors are retryable
    if (status && status >= 500) return true;
    if (err.code === 'ECONNABORTED') return true;
    if (!err.response) return true;

    return false;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    context: string,
  ): Promise<T> {
    const maxAttempts = this.config.retryMaxAttempts || 3;
    const initialDelayMs = this.config.retryInitialDelayMs || 1000;
    const maxDelayMs = this.config.retryMaxDelayMs || 30000;
    const backoffMultiplier = this.config.retryBackoffMultiplier || 2;

    let lastError: RetryableAxiosError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err as RetryableAxiosError;

        if (attempt === maxAttempts || !this.isRetryableError(lastError)) {
          this.logger.error(
            `${context} failed after ${attempt} attempt(s): ${lastError?.message || lastError}`,
          );
          throw lastError;
        }

        const delay = Math.min(
          initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs,
        );

        this.logger.warn(
          `${context} attempt ${attempt} failed (${lastError?.message || lastError}); retrying in ${delay}ms`,
        );
        await this.sleep(delay);
      }
    }

    // Should not be reached, but TypeScript requires a return/throw
    throw lastError;
  }

  async pinFile(
    file: IpfsFile,
    metadata: Record<string, unknown>,
  ): Promise<string> {
    const form = new FormData();

    if (file.path) {
      form.append('file', createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } else if (file.buffer) {
      form.append('file', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } else {
      throw new Error('No file data provided');
    }

    form.append(
      'pinataMetadata',
      JSON.stringify({ name: file.originalname, keyvalues: metadata }),
    );

    const res = await this.withRetry(
      () =>
        axios.post<{ IpfsHash?: string; cid?: string; hash?: string }>(
          `${this.base}/pinning/pinFileToIPFS`,
          form,
          {
            headers: { ...this.authHeaders, ...form.getHeaders() },
            timeout: this.config.timeout,
          },
        ),
      `Pinata pinFile (${file.originalname})`,
    );

    return res.data.IpfsHash || res.data.cid || res.data.hash || '';
  }

  async getContent(cid: string): Promise<IpfsContent> {
    try {
      const url = `${this.config.gateway.replace(/\/$/, '')}/${cid}`;
      const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: this.config.timeout,
      });
      return {
        cid,
        data: Buffer.from(res.data),
        contentType: res.headers['content-type'],
      };
    } catch (err: any) {
      this.logger.error(`Failed to retrieve CID ${cid}:`, err?.message);
      return { cid, error: 'retrieval-failed', details: err?.message };
    }
  }

  async unpin(cid: string): Promise<void> {
    await axios.delete(`${this.base}/pinning/unpin/${cid}`, {
      headers: this.authHeaders,
      timeout: this.config.timeout,
    });
  }

  async pinBatch(cids: string[]): Promise<BatchPinResult[]> {
    return Promise.all(
      cids.map(async (cid) => {
        try {
          await this.withRetry(
            () =>
              axios.post(
                `${this.base}/pinning/pinByHash`,
                { hashToPin: cid },
                {
                  headers: {
                    ...this.authHeaders,
                    'Content-Type': 'application/json',
                  },
                  timeout: this.config.timeout,
                },
              ),
            `Pinata pinBatch (${cid})`,
          );
          return { cid, success: true };
        } catch (err: any) {
          this.logger.warn(`Failed to pin CID ${cid}:`, err?.message);
          return { cid, success: false, error: err?.message };
        }
      }),
    );
  }
}
