import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const CONNECT_RETRY_MS = 2000;
const CONNECT_RETRIES = 5;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
      try {
        await this.$connect();
        this.logger.log('Database connection established');
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Database connection attempt ${attempt}/${CONNECT_RETRIES} failed: ${message}`,
        );
        if (attempt === CONNECT_RETRIES) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, CONNECT_RETRY_MS));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
