import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Unit of Work: runs multiple operations in a single database transaction.
 * Failed operations roll back without leaving orphaned data.
 * Use for atomic multi-repository operations.
 */
@Injectable()
export class UnitOfWorkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a function within a transaction. On throw, the transaction is rolled back.
   * @param fn Function receiving the Prisma transaction client (tx). Use tx.company, tx.user, etc.
   * @returns The value returned by fn.
   */
  async run<T>(fn: (tx: Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => fn(tx as any));
  }
}
