import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ComplianceFramework } from './check-compliance.dto';

export { ComplianceFramework };

export enum OffsetClaimStatus {
  VERIFIED = 'VERIFIED',
  CLAIMED = 'CLAIMED',
  PENDING = 'PENDING',
  INVALID = 'INVALID',
  NOT_RETIRED = 'NOT_RETIRED',
  ALREADY_CLAIMED = 'ALREADY_CLAIMED',
}

export class TokenVerificationItem {
  @IsString()
  tokenId: string;

  @IsOptional()
  @IsString()
  retirementTxHash?: string;
}

export class VerifyRetirementDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TokenVerificationItem)
  tokens: TokenVerificationItem[];

  @IsOptional()
  @IsEnum(ComplianceFramework)
  framework?: ComplianceFramework;

  @IsOptional()
  @IsString()
  claimPurpose?: string;
}

export class TokenVerificationResult {
  tokenId: string;
  status: OffsetClaimStatus;
  retirementTxHash?: string;
  retiredAt?: string;
  originalAmount?: number;
  claimedAmount?: number;
  remainingAmount?: number;
  onChainVerified: boolean;
  claimedBy?: string[];
  claimHistory?: Array<{
    framework: ComplianceFramework;
    claimedAt: string;
    claimedBy: string;
  }>;
  message: string;
}

export class RetirementVerificationResponse {
  verified: boolean;
  totalTokens: number;
  verifiedTokens: number;
  claimedTokens: number;
  notRetiredTokens: number;
  results: TokenVerificationResult[];
  timestamp: string;
}

export class RetirementStatusDto {
  @IsString()
  tokenId: string;

  @IsOptional()
  @IsEnum(ComplianceFramework)
  framework?: ComplianceFramework;
}

export class RetirementStatusResult {
  tokenId: string;
  retirementTxHash?: string;
  isRetired: boolean;
  totalAmount: number;
  claimedAmount: number;
  remainingAmount: number;
  retirementVerified: boolean;
  blockchainStatus: 'CONFIRMED' | 'PENDING' | 'NOT_FOUND';
  claims: Array<{
    framework: ComplianceFramework;
    claimedAt: string;
    claimedBy: string;
  }>;
  auditTrail: Array<{
    action: string;
    timestamp: string;
    details: Record<string, unknown>;
  }>;
}

export class BlockOffsetClaimDto {
  @IsArray()
  @IsString({ each: true })
  tokenIds: string[];

  @IsOptional()
  @IsEnum(ComplianceFramework)
  framework?: ComplianceFramework;
}
