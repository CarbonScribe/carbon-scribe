import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import {
  AuditAction,
  AuditEventType,
} from '../interfaces/audit-event.interface';

export class CreateAuditLogDto {
  @IsEnum(AuditEventType)
  eventType: AuditEventType;

  @IsEnum(AuditAction)
  action: AuditAction;

  @IsString()
  entityType: string;

  @IsString()
  entityId: string;

  @IsOptional()
  previousState?: unknown;

  @IsOptional()
  newState?: unknown;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
