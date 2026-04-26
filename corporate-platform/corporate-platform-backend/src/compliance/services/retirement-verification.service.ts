import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { SorobanService } from '../../stellar/soroban/soroban.service';
import { RetirementTrackerService } from '../../stellar/soroban/contracts/retirement-tracker.service';
import { SecurityService } from '../../security/security.service';
import { RETIREMENT_TRACKER_CONTRACT_ID } from '../../stellar/soroban/contracts/contract.interface';
import {
  VerifyRetirementDto,
  RetirementVerificationResponse,
  TokenVerificationResult,
  TokenVerificationItem,
  RetirementStatusResult,
  OffsetClaimStatus,
  ComplianceFramework,
} from '../dto/retirement-verification.dto';

@Injectable()
export class RetirementVerificationService {
  private readonly logger = new Logger(RetirementVerificationService.name);
  private readonly VERIFICATION_CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sorobanService: SorobanService,
    private readonly retirementTrackerService: RetirementTrackerService,
    private readonly securityService: SecurityService,
  ) {}

  async verifyRetirements(
    companyId: string,
    dto: VerifyRetirementDto,
  ): Promise<RetirementVerificationResponse> {
    if (!dto.tokens || dto.tokens.length === 0) {
      throw new BadRequestException('At least one token must be provided');
    }

    const maxBatchSize = 100;
    if (dto.tokens.length > maxBatchSize) {
      throw new BadRequestException(
        `Batch size exceeds maximum of ${maxBatchSize} tokens`,
      );
    }

    const results = await Promise.all(
      dto.tokens.map((token) =>
        this.verifySingleToken(companyId, token, dto.framework),
      ),
    );

    const summary = this.buildVerificationSummary(results);

    await this.securityService.logEvent({
      eventType: 'retirement.verification.batch' as any,
      companyId,
      details: {
        totalTokens: dto.tokens.length,
        verified: summary.verifiedTokens,
        claimed: summary.claimedTokens,
        notRetired: summary.notRetiredTokens,
        framework: dto.framework,
      },
      status: summary.notRetiredTokens === 0 ? 'success' : 'warning',
    });

    await this.storeVerificationAuditLog(companyId, results, dto.framework);

    return {
      verified: summary.verified,
      totalTokens: summary.totalTokens,
      verifiedTokens: summary.verifiedTokens,
      claimedTokens: summary.claimedTokens,
      notRetiredTokens: summary.notRetiredTokens,
      results,
      timestamp: new Date().toISOString(),
    };
  }

  async getRetirementStatus(
    companyId: string,
    tokenId: string,
    framework?: ComplianceFramework,
  ): Promise<RetirementStatusResult> {
    const credit = await this.prisma.credit.findFirst({
      where: { id: tokenId },
      include: { retirements: true },
    });

    if (!credit) {
      throw new NotFoundException(`Token ${tokenId} not found`);
    }

    const retirement = await this.findRetirementForToken(companyId, tokenId);
    const onChainStatus = await this.queryOnChainRetirement(companyId, tokenId);
    const claims = await this.getClaimHistory(tokenId, framework);
    const auditTrail = await this.getAuditTrail(tokenId);

    const totalAmount = credit.retirements.reduce(
      (sum, r) => sum + r.amount,
      0,
    );
    const claimedAmount = await this.calculateClaimedAmount(tokenId, framework);

    return {
      tokenId,
      retirementTxHash: retirement?.id,
      isRetired: !!retirement,
      totalAmount,
      claimedAmount,
      remainingAmount: totalAmount - claimedAmount,
      retirementVerified: onChainStatus.confirmed,
      blockchainStatus: onChainStatus.status,
      claims,
      auditTrail,
    };
  }

  async verifyTokenForCompliance(
    companyId: string,
    tokenId: string,
    framework: ComplianceFramework,
    requiredAmount?: number,
  ): Promise<{
    valid: boolean;
    message: string;
    details?: Record<string, unknown>;
  }> {
    const status = await this.getRetirementStatus(
      companyId,
      tokenId,
      framework,
    );

    if (!status.isRetired) {
      return {
        valid: false,
        message: `Token ${tokenId} has not been retired on-chain`,
      };
    }

    if (!status.retirementVerified) {
      return {
        valid: false,
        message: `Token ${tokenId} retirement not verified on Stellar blockchain`,
      };
    }

    if (requiredAmount && status.remainingAmount < requiredAmount) {
      return {
        valid: false,
        message: `Token ${tokenId} has insufficient remaining amount. Required: ${requiredAmount}, Available: ${status.remainingAmount}`,
      };
    }

    const alreadyClaimed = status.claims.some(
      (claim) => claim.framework === framework && claim.claimedBy === companyId,
    );

    if (alreadyClaimed) {
      return {
        valid: false,
        message: `Token ${tokenId} has already been claimed for ${framework} by this company`,
      };
    }

    return {
      valid: true,
      message: `Token ${tokenId} is valid for ${framework} compliance claim`,
      details: {
        totalAmount: status.totalAmount,
        remainingAmount: status.remainingAmount,
        blockchainStatus: status.blockchainStatus,
      },
    };
  }

  async blockDoubleClaim(
    companyId: string,
    tokenIds: string[],
    framework: ComplianceFramework,
  ): Promise<{ blocked: boolean; blockedTokens: string[] }> {
    const alreadyClaimed = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const status = await this.getRetirementStatus(
          companyId,
          tokenId,
          framework,
        );
        const isClaimed = status.claims.some(
          (claim) => claim.framework === framework,
        );
        return isClaimed ? tokenId : null;
      }),
    );

    const blockedTokens = alreadyClaimed.filter((id) => id !== null);

    await this.securityService.logEvent({
      eventType: 'retirement.double_claim.blocked' as any,
      companyId,
      details: { framework, blockedTokens, count: blockedTokens.length },
      status: blockedTokens.length > 0 ? 'warning' : 'success',
    });

    return {
      blocked: blockedTokens.length > 0,
      blockedTokens,
    };
  }

  private async verifySingleToken(
    companyId: string,
    token: TokenVerificationItem,
    framework?: ComplianceFramework,
  ): Promise<TokenVerificationResult> {
    const credit = await this.prisma.credit.findFirst({
      where: { id: token.tokenId },
      include: { retirements: { include: { company: true } } },
    });

    if (!credit) {
      return this.buildFailedResult(
        token.tokenId,
        OffsetClaimStatus.INVALID,
        'Token not found',
      );
    }

    const retirement = credit.retirements[0];

    if (!retirement) {
      return this.buildFailedResult(
        token.tokenId,
        OffsetClaimStatus.NOT_RETIRED,
        'Token has not been retired',
      );
    }

    const onChainResult = await this.queryOnChainRetirement(
      companyId,
      token.tokenId,
    );

    if (!onChainResult.confirmed) {
      return {
        tokenId: token.tokenId,
        status: OffsetClaimStatus.PENDING,
        retirementTxHash: token.retirementTxHash,
        message: 'Retirement pending on-chain confirmation',
        onChainVerified: false,
        ...(onChainResult.status && { blockchainStatus: onChainResult.status }),
      };
    }

    const claimedAmount = await this.calculateClaimedAmount(
      token.tokenId,
      framework,
    );
    const remainingAmount = retirement.amount - claimedAmount;

    if (remainingAmount <= 0) {
      return {
        tokenId: token.tokenId,
        status: OffsetClaimStatus.ALREADY_CLAIMED,
        retirementTxHash: retirement.id,
        retiredAt: retirement.retiredAt?.toISOString(),
        originalAmount: retirement.amount,
        claimedAmount,
        remainingAmount: 0,
        onChainVerified: true,
        claimedBy: credit.retirements.map((r) => r.companyId),
        message: `Token already fully claimed for ${framework || 'compliance'}`,
      };
    }

    const claimHistory = await this.getClaimHistory(token.tokenId, framework);

    return {
      tokenId: token.tokenId,
      status: OffsetClaimStatus.VERIFIED,
      retirementTxHash: retirement.id,
      retiredAt: retirement.retiredAt?.toISOString(),
      originalAmount: retirement.amount,
      claimedAmount,
      remainingAmount,
      onChainVerified: true,
      claimHistory: claimHistory.map((c) => ({
        framework: c.framework,
        claimedAt: c.claimedAt,
        claimedBy: c.claimedBy,
      })),
      message: 'Token verified and available for offset claim',
    };
  }

  private async queryOnChainRetirement(
    companyId: string,
    tokenId: string,
  ): Promise<{
    confirmed: boolean;
    status?: 'CONFIRMED' | 'PENDING' | 'NOT_FOUND';
  }> {
    try {
      const contractId =
        process.env.RETIREMENT_TRACKER_CONTRACT_ID ||
        RETIREMENT_TRACKER_CONTRACT_ID;

      const simulation = await this.sorobanService.simulateContractCall({
        contractId,
        methodName: 'check_retirement_status',
        args: [{ type: 'u64', value: tokenId }],
      });

      const result = simulation.result as Record<string, unknown>;

      if (result && typeof result === 'object') {
        const status = (result as any).status || (result as any);
        return {
          confirmed: status === 'confirmed' || status === true,
          status: this.mapContractStatus(status),
        };
      }

      return { confirmed: false, status: 'NOT_FOUND' };
    } catch (error) {
      this.logger.warn(
        `On-chain retirement query failed for ${tokenId}: ${(error as Error).message}`,
      );
      return { confirmed: false, status: 'NOT_FOUND' };
    }
  }

  private async findRetirementForToken(
    companyId: string,
    tokenId: string,
  ): Promise<Prisma.RetirementGetPayload<false> | null> {
    return this.prisma.retirement.findFirst({
      where: {
        companyId,
        creditId: tokenId,
      },
      orderBy: { retiredAt: 'desc' },
    });
  }

  private async calculateClaimedAmount(
    tokenId: string,
    framework?: ComplianceFramework,
  ): Promise<number> {
    const where: Prisma.CorsiaEligibleCreditWhereInput = {};

    if (framework) {
      where.program = framework;
    }

    const eligibleCredits = await this.prisma.corsiaEligibleCredit.findMany({
      where,
      include: {
        retirement: {
          include: { credit: true },
        },
      },
    });

    return eligibleCredits
      .filter((ec) => ec.retirement?.creditId === tokenId)
      .reduce((sum, ec) => sum + (ec.retirement?.amount || 0), 0);
  }

  private async getClaimHistory(
    tokenId: string,
    framework?: ComplianceFramework,
  ): Promise<
    Array<{
      framework: ComplianceFramework;
      claimedAt: string;
      claimedBy: string;
    }>
  > {
    const eligibleCredits = await this.prisma.corsiaEligibleCredit.findMany({
      where: framework ? { program: framework } : {},
      include: {
        retirement: {
          include: { company: true },
        },
      },
    });

    return eligibleCredits
      .filter((ec) => ec.retirement?.creditId === tokenId)
      .map((ec) => ({
        framework: ec.program as ComplianceFramework,
        claimedAt: ec.updatedAt.toISOString(),
        claimedBy: ec.retirement?.companyId || 'unknown',
      }));
  }

  private async getAuditTrail(_tokenId: string): Promise<
    Array<{
      action: string;
      timestamp: string;
      details: Record<string, unknown>;
    }>
  > {
    const events = await this.prisma.contractCall.findMany({
      where: {
        methodName: { in: ['verify_retirement', 'check_retirement_status'] },
      },
      orderBy: { submittedAt: 'desc' },
      take: 10,
    });

    return events.map((event) => ({
      action: event.methodName,
      timestamp: event.submittedAt.toISOString(),
      details: {
        txHash: event.transactionHash,
        status: event.status,
      },
    }));
  }

  private async storeVerificationAuditLog(
    companyId: string,
    results: TokenVerificationResult[],
    framework?: ComplianceFramework,
  ): Promise<void> {
    try {
      await this.prisma.retirementVerification.create({
        data: {
          retirementId: 'batch',
          tokenIds: results.map((r) => {
            const numId = parseInt(
              r.tokenId.replace(/\D/g, '').slice(0, 10),
              10,
            );
            return isNaN(numId) ? 0 : numId;
          }),
          amount: results.filter((r) => r.status === OffsetClaimStatus.VERIFIED)
            .length,
          transactionHash: `verify_${Date.now()}`,
          blockNumber: 0,
          proof: {
            framework,
            results: results.map((r) => ({
              tokenId: r.tokenId,
              status: r.status,
              verified: r.onChainVerified,
            })),
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to store verification audit log: ${(error as Error).message}`,
      );
    }
  }

  private buildVerificationSummary(results: TokenVerificationResult[]): {
    verified: boolean;
    totalTokens: number;
    verifiedTokens: number;
    claimedTokens: number;
    notRetiredTokens: number;
  } {
    const summary = {
      verified: false,
      totalTokens: results.length,
      verifiedTokens: 0,
      claimedTokens: 0,
      notRetiredTokens: 0,
    };

    for (const result of results) {
      if (result.status === OffsetClaimStatus.VERIFIED) {
        summary.verifiedTokens++;
      } else if (result.status === OffsetClaimStatus.ALREADY_CLAIMED) {
        summary.claimedTokens++;
      } else if (result.status === OffsetClaimStatus.NOT_RETIRED) {
        summary.notRetiredTokens++;
      }
    }

    summary.verified =
      summary.verifiedTokens === summary.totalTokens &&
      summary.notRetiredTokens === 0;

    return summary;
  }

  private buildFailedResult(
    tokenId: string,
    status: OffsetClaimStatus,
    message: string,
  ): TokenVerificationResult {
    return {
      tokenId,
      status,
      message,
      onChainVerified: false,
    };
  }

  async getVerificationHistory(
    companyId: string,
    options?: {
      tokenId?: string;
      framework?: ComplianceFramework;
      limit?: number;
      offset?: number;
    },
  ): Promise<{
    total: number;
    items: Array<{
      id: string;
      tokenId: string;
      status: string;
      onChainVerified: boolean;
      framework?: string;
      verifiedAt: string;
    }>;
  }> {
    const where: Prisma.ContractCallWhereInput = {
      contractId:
        process.env.RETIREMENT_TRACKER_CONTRACT_ID ||
        RETIREMENT_TRACKER_CONTRACT_ID,
      methodName: { in: ['check_retirement_status', 'verify_retirement'] },
    };

    if (options?.tokenId) {
      const tokenId = options.tokenId;
      where.args = { path: ['tokenId'], string_contains: tokenId };
    }

    const limit = Math.min(options?.limit || 50, 100);
    const offset = options?.offset || 0;

    const [calls, total] = await Promise.all([
      this.prisma.contractCall.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.contractCall.count({ where }),
    ]);

    const items = calls.map((call) => ({
      id: call.id,
      tokenId: this.extractTokenId(call.args),
      status: call.status,
      onChainVerified: call.status === 'CONFIRMED',
      framework: options?.framework,
      verifiedAt:
        call.confirmedAt?.toISOString() || call.submittedAt.toISOString(),
    }));

    return { total, items };
  }

  private extractTokenId(args: Prisma.InputJsonValue): string {
    if (typeof args === 'object' && args !== null) {
      const arr = Array.isArray(args)
        ? args
        : (args as Record<string, unknown>);
      if (Array.isArray(arr)) {
        const tokenArg = arr.find(
          (a) =>
            typeof a === 'object' &&
            a !== null &&
            'type' in (a as Record<string, unknown>) &&
            (a as Record<string, unknown>).type === 'u64',
        );
        if (
          tokenArg &&
          typeof (tokenArg as Record<string, unknown>).value !== 'undefined'
        ) {
          return String((tokenArg as Record<string, unknown>).value);
        }
      }
    }
    return '';
  }

  private mapContractStatus(
    status: unknown,
  ): 'CONFIRMED' | 'PENDING' | 'NOT_FOUND' {
    if (status === 'SUCCESS' || status === 'confirmed' || status === true) {
      return 'CONFIRMED';
    }
    if (status === 'PENDING' || status === 'pending') {
      return 'PENDING';
    }
    return 'NOT_FOUND';
  }
}
