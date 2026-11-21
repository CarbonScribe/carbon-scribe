import {
  Injectable,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AcquireResult {
  isReplay: boolean;
  responseStatus?: number;
  responseBody?: any;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly TTL_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Attempts to acquire an idempotency lock for the request.
   * If a matching completed record exists, returns the cached response.
   * If a pending record exists, throws ConflictException (409).
   * If payload hash differs, throws UnprocessableEntityException (422).
   */
  async acquire(
    key: string,
    companyId: string,
    route: string,
    requestHash: string,
  ): Promise<AcquireResult> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.TTL_HOURS * 60 * 60 * 1000);

    const prisma = this.prisma as any;

    // 1. Check for existing record
    const existing = await prisma.idempotencyRecord.findFirst({
      where: { companyId, key },
    });

    if (existing) {
      // If expired, reset to pending
      if (new Date(existing.expiresAt) <= now) {
        await prisma.idempotencyRecord.updateMany({
          where: { id: existing.id },
          data: {
            route,
            requestHash,
            status: 'pending',
            responseStatus: null,
            responseBody: Prisma.DbNull,
            createdAt: now,
            expiresAt,
          },
        });
        return { isReplay: false };
      }

      // If payload differs, reject with 422
      if (existing.requestHash !== requestHash) {
        throw new UnprocessableEntityException(
          'Idempotency key reused with different request payload',
        );
      }

      // If pending, conflict 409
      if (existing.status === 'pending') {
        throw new ConflictException(
          'A request with this idempotency key is currently in progress',
        );
      }

      // If completed, return cached replay
      if (existing.status === 'completed') {
        return {
          isReplay: true,
          responseStatus: existing.responseStatus ?? 200,
          responseBody: existing.responseBody,
        };
      }

      // If previously failed, allow retry
      if (existing.status === 'failed') {
        await prisma.idempotencyRecord.updateMany({
          where: { id: existing.id },
          data: {
            route,
            requestHash,
            status: 'pending',
            responseStatus: null,
            responseBody: Prisma.DbNull,
            createdAt: now,
            expiresAt,
          },
        });
        return { isReplay: false };
      }
    }

    // 2. Insert fresh pending record
    try {
      await prisma.idempotencyRecord.create({
        data: {
          key,
          companyId,
          route,
          requestHash,
          status: 'pending',
          expiresAt,
        },
      });
      return { isReplay: false };
    } catch (error: any) {
      // Concurrency race: another request inserted with the same (companyId, key)
      if (error?.code === 'P2002') {
        const concurrent = await prisma.idempotencyRecord.findFirst({
          where: { companyId, key },
        });

        if (!concurrent) {
          throw error;
        }

        if (concurrent.requestHash !== requestHash) {
          throw new UnprocessableEntityException(
            'Idempotency key reused with different request payload',
          );
        }

        if (concurrent.status === 'pending') {
          throw new ConflictException(
            'A request with this idempotency key is currently in progress',
          );
        }

        if (concurrent.status === 'completed') {
          return {
            isReplay: true,
            responseStatus: concurrent.responseStatus ?? 200,
            responseBody: concurrent.responseBody,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Marks the idempotency record as completed with the response data.
   */
  async complete(
    key: string,
    companyId: string,
    responseStatus: number,
    responseBody: any,
  ): Promise<void> {
    const sanitizedBody =
      responseBody !== undefined
        ? JSON.parse(JSON.stringify(responseBody))
        : Prisma.DbNull;

    const prisma = this.prisma as any;
    await prisma.idempotencyRecord.updateMany({
      where: { companyId, key },
      data: {
        status: 'completed',
        responseStatus,
        responseBody: sanitizedBody,
      },
    });
  }

  /**
   * Marks the idempotency record as failed so client can retry.
   */
  async fail(key: string, companyId: string): Promise<void> {
    try {
      const prisma = this.prisma as any;
      await prisma.idempotencyRecord.updateMany({
        where: { companyId, key, status: 'pending' },
        data: {
          status: 'failed',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to mark idempotency record as failed: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * Cleans up expired idempotency records.
   */
  async cleanupExpired(): Promise<number> {
    const prisma = this.prisma as any;
    const result = await prisma.idempotencyRecord.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}
