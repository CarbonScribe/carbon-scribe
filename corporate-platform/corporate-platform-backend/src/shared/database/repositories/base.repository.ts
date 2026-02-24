import { PrismaService } from '../prisma.service';

/**
 * Base repository that wraps a Prisma delegate (e.g. prisma.company, prisma.user).
 * Reduces boilerplate for entity-specific repositories.
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

  async findUnique(args: any): Promise<any> {
    return this.delegate.findUnique(args);
  }

  async findFirst(args: any): Promise<any> {
    return this.delegate.findFirst(args);
  }

  async findMany(args?: any): Promise<any[]> {
    return this.delegate.findMany(args);
  }

  async create(args: any): Promise<any> {
    return this.delegate.create(args);
  }

  async update(args: any): Promise<any> {
    return this.delegate.update(args);
  }

  async delete(args: any): Promise<any> {
    return this.delegate.delete(args);
  }

  async count(args?: any): Promise<number> {
    return this.delegate.count(args);
  }
}
