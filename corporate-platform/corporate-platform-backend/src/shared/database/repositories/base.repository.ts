import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';
import {
  DatabaseRecordNotFoundError,
  UniqueConstraintViolationError,
  DatabaseError,
} from '../../exceptions/error-classes';

/**
 * Base repository that wraps a Prisma delegate (e.g. prisma.company, prisma.user).
 * Reduces boilerplate for entity-specific repositories.
 *
 * All database operations are wrapped with error translation to convert
 * Prisma errors into domain errors.
 */
export abstract class BaseRepository<
  Delegate extends {
    findUnique: (args: any) => Promise<any>;
    findFirst: (args: any) => Promise<any>;
    findMany: (args?: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
    delete: (args: any) => Promise<any>;
    count: (args?: any) => Promise<number>;
  },
> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly delegate: Delegate,
  ) {}

  /**
   * Find a unique record by its identifier
   * @throws {DatabaseRecordNotFoundError} if record not found
   */
  async findUnique(args: any): Promise<any> {
    try {
      return await this.delegate.findUnique(args);
    } catch (error: unknown) {
      throw this.translateError(error);
    }
  }

  /**
   * Find the first record matching the criteria
   * @throws {DatabaseRecordNotFoundError} if no record found
   */
  async findFirst(args: any): Promise<any> {
    try {
      return await this.delegate.findFirst(args);
    } catch (error: unknown) {
      throw this.translateError(error);
    }
  }

  /**
   * Find multiple records matching the criteria
   */
  async findMany(args?: any): Promise<any[]> {
    try {
      return await this.delegate.findMany(args);
    } catch (error: unknown) {
      throw this.translateError(error);
    }
  }

  /**
   * Create a new record
   * @throws {UniqueConstraintViolationError} if unique constraint violated
   */
  async create(args: any): Promise<any> {
    try {
      return await this.delegate.create(args);
    } catch (error: unknown) {
      throw this.translateError(error);
    }
  }

  /**
   * Update an existing record
   * @throws {DatabaseRecordNotFoundError} if record not found
   * @throws {UniqueConstraintViolationError} if unique constraint violated
   */
  async update(args: any): Promise<any> {
    try {
      return await this.delegate.update(args);
    } catch (error: unknown) {
      throw this.translateError(error);
    }
  }

  /**
   * Delete a record
   * @throws {DatabaseRecordNotFoundError} if record not found
   */
  async delete(args: any): Promise<any> {
    try {
      return await this.delegate.delete(args);
    } catch (error: unknown) {
      throw this.translateError(error);
    }
  }

  /**
   * Count records matching the criteria
   */
  async count(args?: any): Promise<number> {
    try {
      return await this.delegate.count(args);
    } catch (error: unknown) {
      throw this.translateError(error);
    }
  }

  /**
   * Translate Prisma errors to domain errors
   */
  private translateError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const { code, meta } = error;

      // P2025: Record not found
      if (code === 'P2025') {
        const model = (meta as any)?.modelName || 'Record';
        const id = (meta as any)?.id;
        return new DatabaseRecordNotFoundError(model, id, {
          prismaError: code,
        });
      }

      // P2002: Unique constraint violation
      if (code === 'P2002') {
        const target = (meta as any)?.target || 'field';
        const field = Array.isArray(target) ? target.join(', ') : target;
        return new UniqueConstraintViolationError(field, 'unknown', {
          prismaError: code,
        });
      }

      // P2003: Foreign key constraint violation
      if (code === 'P2003') {
        const field = (meta as any)?.field_name || 'foreign key';
        return new DatabaseRecordNotFoundError('Related record', undefined, {
          field,
          prismaError: code,
        });
      }

      // Default database error
      return new DatabaseError(`Database operation failed: ${error.message}`, {
        prismaError: code,
        meta,
      });
    }

    // Re-throw non-Prisma errors
    return error instanceof Error ? error : new Error(String(error));
  }
}
