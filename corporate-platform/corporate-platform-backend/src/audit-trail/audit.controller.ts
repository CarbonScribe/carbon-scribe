import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AnchorHashDto } from './dto/anchor-hash.dto';
import { RetirementAuditHashService } from './services/retirement-audit-hash.service';

/**
 * AuditController — endpoints for retirement audit hash anchoring & verification.
 *
 * Base path: /api/v1/audit
 *
 * Access control:
 *   POST /anchor-hash   — roles: admin, manager, auditor
 *     Anchoring is a mutating, on-chain operation that generates costs and
 *     immutable records. Restricted to roles with compliance authority.
 *
 *   GET  /verify-hash/:tokenId — roles: admin, auditor, analyst
 *     Verification is read-only. Open to analysts for regulatory reporting.
 *
 * Rate limiting is applied by AuditRateLimitMiddleware (registered in
 * AuditTrailModule.configure) to both endpoints.
 */
@Controller('api/v1/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(
    private readonly retirementAuditHashService: RetirementAuditHashService,
  ) {}

  /**
   * POST /api/v1/audit/anchor-hash
   *
   * Generate a SHA-256 audit hash for the provided `auditRecord` and anchor it
   * to the Retirement Tracker smart contract for token `tokenId`.
   *
   * The audit hash is stored off-chain; the on-chain Soroban transaction hash
   * (`onChainTxHash`) serves as the immutable, tamper-proof cryptographic proof.
   *
   * Duplicate requests for the same (tokenId, auditRecord) are idempotent:
   * a CONFIRMED anchor record is returned immediately without re-invoking
   * the contract.
   *
   * Required roles: admin | manager | auditor
   */
  @Post('anchor-hash')
  @Roles('admin', 'manager', 'auditor')
  async anchorHash(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AnchorHashDto,
  ) {
    return this.retirementAuditHashService.anchorHash({
      tokenId: dto.tokenId,
      auditEventId: dto.auditEventId,
      auditRecord: dto.auditRecord,
      companyId: user.companyId,
      userId: user.sub,
    });
  }

  /**
   * GET /api/v1/audit/verify-hash/:tokenId
   *
   * Retrieve the audit hash anchor for the given on-chain retirement token ID
   * and verify it against the current on-chain retirement record.
   *
   * `txProofConfirmed` in the response is `true` when the stored anchor has
   * an associated CONFIRMED Soroban transaction — this is the cryptographic
   * proof of the anchoring action.
   *
   * The audit hash itself is NOT stored on-chain; this endpoint confirms the
   * anchoring transaction was accepted by the Stellar network.
   *
   * Required roles: admin | auditor | analyst
   */
  @Get('verify-hash/:tokenId')
  @Roles('admin', 'auditor', 'analyst')
  async verifyHash(
    @CurrentUser() user: JwtPayload,
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ) {
    return this.retirementAuditHashService.verifyHash(user.companyId, tokenId);
  }
}
