import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for POST /api/v1/audit/anchor-hash
 *
 * `tokenId` is the numeric on-chain retirement token ID (u32) from the
 * Soroban RetirementTracker contract.
 *
 * `auditRecord` is the full audit record payload that will be hashed.
 * The server performs deterministic serialization (sorted keys, stable JSON)
 * before computing the SHA-256 digest — callers must not pre-hash.
 */
export class AnchorHashDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  tokenId: number;

  @IsOptional()
  @IsString()
  auditEventId?: string;

  /**
   * Full audit record object. All fields are included in the hash.
   * Keys are sorted recursively before hashing to guarantee determinism
   * regardless of insertion order.
   */
  @IsObject()
  auditRecord: Record<string, unknown>;
}
