import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { IpfsConfig } from './ipfs.config';

@Injectable()
export class PinataHealthService implements OnModuleInit {
  private readonly logger = new Logger(PinataHealthService.name);

  constructor(private readonly ipfsConfig: IpfsConfig) {}

  async onModuleInit() {
    this.logger.log('Validating Pinata API credential connectivity...');
    try {
      const response = await fetch(
        'https://api.pinata.cloud/data/testAuthentication',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.ipfsConfig.jwt}`,
          },
          signal: AbortSignal.timeout(this.ipfsConfig.timeout),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata status ${response.status}: ${errorText}`);
      }

      this.logger.log('Pinata credential health check passed successfully.');
    } catch (error) {
      this.logger.error(
        `CRITICAL FATAL: Pinata startup health check failed. Ensure PINATA_JWT is valid. Error: ${error.message}`,
      );
      // Fail fast and prevent startup
      process.exit(1);
    }
  }
}
