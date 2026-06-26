import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class IpfsConfig {
  constructor(private readonly configService: ConfigService) {}

  get apiKey(): string {
    return this.configService.get<string>('PINATA_API_KEY');
  }

  get secretKey(): string {
    return this.configService.get<string>('PINATA_SECRET_KEY');
  }

  get jwt(): string {
    return this.configService.get<string>('PINATA_JWT');
  }

  get gateway(): string {
    return this.configService.get<string>('PINATA_GATEWAY');
  }

  get fallback(): string {
    return (
      this.configService.get<string>('IPFS_GATEWAY') || 'https://ipfs.io/ipfs/'
    );
  }

  get timeout(): number {
    return this.configService.get<number>('PINATA_TIMEOUT_MS');
  }

  get retryMaxAttempts(): number {
    return this.configService.get<number>('PINATA_RETRY_MAX_ATTEMPTS');
  }

  get retryInitialDelayMs(): number {
    return this.configService.get<number>('PINATA_RETRY_INITIAL_DELAY_MS');
  }

  get retryMaxDelayMs(): number {
    return this.configService.get<number>('PINATA_RETRY_MAX_DELAY_MS');
  }

  get retryBackoffMultiplier(): number {
    return this.configService.get<number>('PINATA_RETRY_BACKOFF_MULTIPLIER');
  }
}
