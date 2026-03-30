import {
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TenantContextStore } from '../../multi-tenant/tenant-context.store';

const CONNECT_RETRY_MS = 2000;
const CONNECT_RETRIES = 5;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly scopedModelsWithCompanyId = new Set<string>([
    'RetirementTarget',
    'Project',
    'Retirement',
    'User',
    'IpWhitelist',
    'AuditLog',
    'AuditEvent',
    'Bid',
    'RetirementSchedule',
    'BatchRetirement',
    'Credit',
    'Cart',
    'Order',
    'Portfolio',
    'Transaction',
    'Compliance',
    'Report',
    'Activity',
    'ApiKey',
    'TeamMember',
    'Role',
    'Invitation',
    'IpfsDocument',
    'TransactionConfirmation',
    'FlightRecord',
    'CorsiaComplianceYear',
    'CorsiaEligibleCredit',
  ]);

  private readonly scopedModelsByRelation = new Set<string>([
    'Auction',
    'Session',
    'ScheduleExecution',
    'RetirementCertificate',
    'CartItem',
    'OrderItem',
    'OrderAuditLog',
    'CreditReservation',
    'PortfolioHolding',
    'PortfolioSnapshot',
    'PortfolioEntry',
    'CreditAvailabilityLog',
  ]);

  constructor(private readonly tenantContextStore: TenantContextStore) {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });

    const extendedClient = this.$extends({
      query: {
        $allModels: {
          $allOperations: async ({ model, operation, args, query }) => {
            if (!model) {
              return query(args);
            }

            const tenant = this.tenantContextStore.getContext();
            if (!tenant || tenant.bypassIsolation) {
              return query(args);
            }

            if (
              !this.scopedModelsWithCompanyId.has(model) &&
              !this.scopedModelsByRelation.has(model)
            ) {
              return query(args);
            }

            if (this.scopedModelsWithCompanyId.has(model)) {
              const scopedArgs = this.applyDirectCompanyScope(
                operation,
                args,
                tenant.companyId,
              );
              return query(scopedArgs);
            }

            const scopedArgs = this.applyRelationalCompanyScope(
              model,
              operation,
              args,
              tenant.companyId,
            );
            return query(scopedArgs);
          },
        },
      },
    });

    Object.assign(this, extendedClient);
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

  private applyDirectCompanyScope(
    action: string,
    args: any,
    companyId: string,
  ): any {
    const scopedArgs = args ? { ...args } : {};

    switch (action) {
      case 'findUnique':
      case 'findUniqueOrThrow':
      case 'findFirst':
      case 'findFirstOrThrow':
      case 'findMany':
      case 'count':
      case 'aggregate':
      case 'groupBy':
        scopedArgs.where = this.mergeWhereWithTenant(
          scopedArgs.where,
          companyId,
        );
        return scopedArgs;
      case 'create':
      case 'createMany':
        scopedArgs.data = this.mergeDataWithTenant(scopedArgs.data, companyId);
        return scopedArgs;
      case 'update':
      case 'updateMany':
      case 'delete':
      case 'deleteMany':
        scopedArgs.where = this.mergeWhereWithTenant(
          scopedArgs.where,
          companyId,
        );
        if (scopedArgs.data) {
          scopedArgs.data = this.mergeDataWithTenant(
            scopedArgs.data,
            companyId,
          );
        }
        return scopedArgs;
      case 'upsert':
        scopedArgs.where = this.mergeWhereWithTenant(
          scopedArgs.where,
          companyId,
        );
        if (scopedArgs.update) {
          scopedArgs.update = this.mergeDataWithTenant(
            scopedArgs.update,
            companyId,
          );
        }
        if (scopedArgs.create) {
          scopedArgs.create = this.mergeDataWithTenant(
            scopedArgs.create,
            companyId,
          );
        }
        return scopedArgs;
      default:
        return scopedArgs;
    }
  }

  private applyRelationalCompanyScope(
    model: string,
    action: string,
    args: any,
    companyId: string,
  ): any {
    if (!this.isRelationReadAction(action)) {
      return args;
    }

    const relationScope = this.getRelationalScope(model, companyId);
    if (!relationScope) {
      return args;
    }

    const scopedArgs = args ? { ...args } : {};
    scopedArgs.where = this.mergeWhereWithRelationScope(
      scopedArgs.where,
      relationScope,
    );
    return scopedArgs;
  }

  private mergeWhereWithTenant(existingWhere: any, companyId: string): any {
    if (!existingWhere) {
      return { companyId };
    }

    if (
      Object.prototype.hasOwnProperty.call(existingWhere, 'companyId') &&
      existingWhere.companyId !== companyId
    ) {
      throw new ForbiddenException('Cross-tenant query is forbidden');
    }

    return {
      AND: [existingWhere, { companyId }],
    };
  }

  private mergeDataWithTenant(existingData: any, companyId: string): any {
    if (!existingData) {
      return existingData;
    }

    if (Array.isArray(existingData)) {
      return existingData.map((entry) =>
        this.mergeDataWithTenant(entry, companyId),
      );
    }

    if (typeof existingData !== 'object') {
      return existingData;
    }

    if (
      Object.prototype.hasOwnProperty.call(existingData, 'companyId') &&
      existingData.companyId !== companyId
    ) {
      throw new ForbiddenException('Cross-tenant write is forbidden');
    }

    return {
      ...existingData,
      companyId,
    };
  }

  private mergeWhereWithRelationScope(
    existingWhere: any,
    relationScope: any,
  ): any {
    if (!existingWhere) {
      return relationScope;
    }

    return {
      AND: [existingWhere, relationScope],
    };
  }

  private getRelationalScope(model: string, companyId: string): any {
    const byModel: Record<string, any> = {
      Credit: { project: { companyId } },
      Auction: { credit: { companyId } },
      Session: { user: { companyId } },
      ScheduleExecution: { schedule: { companyId } },
      RetirementCertificate: { retirement: { companyId } },
      CartItem: { cart: { companyId } },
      OrderItem: { order: { companyId } },
      OrderAuditLog: { order: { companyId } },
      CreditReservation: { cart: { companyId } },
      PortfolioHolding: { portfolio: { companyId } },
      PortfolioSnapshot: { portfolio: { companyId } },
      PortfolioEntry: { portfolio: { companyId } },
      CreditAvailabilityLog: { credit: { companyId } },
    };

    return byModel[model];
  }

  private isReadAction(action: string): boolean {
    return (
      action === 'findUnique' ||
      action === 'findUniqueOrThrow' ||
      action === 'findFirst' ||
      action === 'findFirstOrThrow' ||
      action === 'findMany' ||
      action === 'count' ||
      action === 'aggregate' ||
      action === 'groupBy'
    );
  }

  private isRelationReadAction(action: string): boolean {
    return (
      action === 'findFirst' ||
      action === 'findFirstOrThrow' ||
      action === 'findMany' ||
      action === 'count' ||
      action === 'aggregate' ||
      action === 'groupBy'
    );
  }
}
