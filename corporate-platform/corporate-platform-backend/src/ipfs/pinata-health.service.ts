import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { IpfsConfig } from './ipfs.config';

@Injectable()
export class PinataHealthService implements OnModuleInit {
  private readonly logger = new Logger(PinataHealthService.name);

  constructor(private readonly ipfsConfig: IpfsConfig) {}

  async onModuleInit() {
    await this.checkPinataCredentials();
    await this.checkGatewayAvailability();
  }

  private async checkPinataCredentials(): Promise<void> {
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

  private async checkGatewayAvailability(): Promise<void> {
    const gateway = this.ipfsConfig.gateway;
    if (!gateway) {
      this.logger.warn(
        'PINATA_GATEWAY not configured; gateway availability check skipped.',
      );
      return;
    }

    this.logger.log(`Checking IPFS gateway availability: ${gateway}`);
    try {
      const response = await fetch(gateway, {
        method: 'HEAD',
        signal: AbortSignal.timeout(this.ipfsConfig.verifyTimeoutMs),
      });

      if (response.status >= 500) {
        throw new Error(
          `Gateway returned server error status ${response.status}`,
        );
      }

      this.logger.log(
        `IPFS gateway available (status ${response.status}).`,
      );
    } catch (error) {
      this.logger.error(
        `IPFS gateway health check failed for ${gateway}: ${error.message}. ` +
          'Pin verification may fail until the gateway is reachable.',
      );
    }
  }
}
