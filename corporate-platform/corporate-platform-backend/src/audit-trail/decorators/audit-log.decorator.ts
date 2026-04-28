import {
  AuditAction,
  AuditEventType,
} from '../interfaces/audit-event.interface';

export interface AuditLogDecoratorOptions {
  eventType: AuditEventType | string;
  action: AuditAction | string;
  entityType: string | ((args: unknown[], result: unknown) => string);
  entityId: string | ((args: unknown[], result: unknown) => string);
  previousState?: (args: unknown[], result: unknown) => unknown;
  newState?: (args: unknown[], result: unknown) => unknown;
  metadata?: (args: unknown[], result: unknown) => Record<string, unknown>;
}

function resolveValue<T>(
  value: T | ((args: unknown[], result: unknown) => T),
  args: unknown[],
  result: unknown,
): T {
  if (typeof value === 'function') {
    return (value as (args: unknown[], result: unknown) => T)(args, result);
  }

  return value;
}

export function AuditLog(options: AuditLogDecoratorOptions): MethodDecorator {
  return (
    _target: object,
    _propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const result = await originalMethod.apply(this, args);

      const auditTrailService = this.auditTrailService || this.auditService;
      if (auditTrailService?.recordDecoratedAuditEvent) {
        const contextUser = this.currentUser || this.user;
        const userArg = args.find(
          (arg) =>
            !!arg &&
            typeof arg === 'object' &&
            ('companyId' in (arg as Record<string, unknown>) ||
              'sub' in (arg as Record<string, unknown>) ||
              'userId' in (arg as Record<string, unknown>)),
        ) as
          | {
              companyId?: string;
              sub?: string;
              userId?: string;
              id?: string;
            }
          | undefined;

        await auditTrailService.recordDecoratedAuditEvent({
          eventType: options.eventType,
          action: options.action,
          entityType: resolveValue(options.entityType, args, result),
          entityId: resolveValue(options.entityId, args, result),
          previousState: options.previousState?.(args, result),
          newState: options.newState?.(args, result),
          metadata: options.metadata?.(args, result) || {},
          companyId:
            contextUser?.companyId || userArg?.companyId || this.companyId,
          userId:
            contextUser?.sub ||
            contextUser?.userId ||
            userArg?.sub ||
            userArg?.userId ||
            userArg?.id ||
            this.userId,
        });
      }

      return result;
    };

    return descriptor;
  };
}
