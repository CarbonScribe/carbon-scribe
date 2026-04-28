import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  NotFoundException,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, interval, from, switchMap, map, catchError, of } from 'rxjs';
import { InstantRetirementService } from './services/instant-retirement.service';
import { HistoryService } from './services/history.service';
import { ValidationService } from './services/validation.service';
import { CertificateService } from './services/certificate.service';
import { RetireCreditsDto } from './dto/retire-credits.dto';
import { RetirementQueryDto } from './dto/retirement-query.dto';
import { Response } from 'express';
import { PrismaService } from '../shared/database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  CREDIT_VIEW,
  CREDIT_RETIRE,
  PORTFOLIO_VIEW,
  PORTFOLIO_EXPORT,
} from '../rbac/constants/permissions.constants';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { SecurityService } from '../security/security.service';
import { SecurityEvents } from '../security/constants/security-events.constants';

/** How often (ms) the SSE feed polls for new retirements */
const SSE_POLL_INTERVAL_MS = 5_000;

@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
@Controller('api/v1/retirements')
export class RetirementController {
  constructor(
    private instantRetirementService: InstantRetirementService,
    private historyService: HistoryService,
    private validationService: ValidationService,
    private certificateService: CertificateService,
    private prisma: PrismaService,
    private securityService: SecurityService,
  ) {}

  @Post()
  @Permissions(CREDIT_RETIRE)
  async retireCredits(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RetireCreditsDto,
  ) {
    const companyId = user.companyId;
    const userId = user.sub;
    const result = await this.instantRetirementService.retire(
      companyId,
      userId,
      dto,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.CreditRetired,
      companyId,
      userId,
      resource: '/api/v1/retirements',
      method: 'POST',
      status: 'success',
      statusCode: 201,
      details: {
        amount: dto.amount,
        creditId: dto.creditId,
      },
    });

    return result;
  }

  @Get()
  @Permissions(PORTFOLIO_VIEW)
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: RetirementQueryDto,
  ) {
    return this.historyService.getHistory(query);
  }

  @Get('stats')
  @Permissions(PORTFOLIO_VIEW)
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.historyService.getStats(user.companyId);
  }

  @Get('purposes')
  @Permissions(CREDIT_VIEW)
  async getPurposes() {
    return ['scope1', 'scope2', 'scope3', 'corporate', 'events', 'product'];
  }

  @Get('validate')
  @Permissions(CREDIT_VIEW)
  async validate(
    @CurrentUser() user: JwtPayload,
    @Query('creditId') creditId: string,
    @Query('amount') amount: number,
  ) {
    return this.validationService.validateRetirement(
      user.companyId,
      creditId,
      Number(amount),
    );
  }

  @Get('export/csv')
  @Permissions(PORTFOLIO_EXPORT)
  async exportCsv(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const csv = await this.historyService.exportCsv(user.companyId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=retirement-history.csv',
    );
    res.send(csv);

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId: user.companyId,
      userId: user.sub,
      resource: '/api/v1/retirements/export/csv',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });
  }

  // ── Issue #233: entity certificates endpoint ──────────────────────────────

  /**
   * GET /api/v1/retirements/entity/:address/certificates
   * List all retirement certificates for a given entity (companyId or Stellar address
   * stored in the retirement's transactionHash prefix).
   * Falls back to matching by companyId if no Stellar address field exists.
   */
  @Get('entity/:address/certificates')
  @Permissions(PORTFOLIO_VIEW)
  async getEntityCertificates(
    @CurrentUser() user: JwtPayload,
    @Param('address') address: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    // Match by companyId (the address param is treated as companyId for now;
    // when a stellarAddress field is added to Company, update this filter).
    const where = { companyId: address };

    const [retirements, total] = await Promise.all([
      this.prisma.retirement.findMany({
        where,
        include: { credit: true, company: true },
        orderBy: { retiredAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.retirement.count({ where }),
    ]);

    return {
      data: retirements.map((r) => ({
        id: r.id,
        certificateId: r.certificateId || `RET-${r.id}`,
        companyName: r.company.name,
        creditProject: r.credit.projectName,
        creditAmount: r.amount,
        purpose: r.purpose,
        retiredAt: r.retiredAt,
        transactionHash: r.transactionHash,
        certificateUrl: `/api/v1/retirements/${r.id}/certificate`,
      })),
      meta: { total, page: Number(page), limit: take },
    };
  }

  // ── Issue #238: live retirement feed (SSE) ────────────────────────────────

  /**
   * GET /api/v1/public/retirements/feed
   * Server-Sent Events stream of live retirement events.
   * Public endpoint — no auth guard applied at method level.
   * Rate-limiting should be applied at the infrastructure/gateway level.
   */
  @Sse('public/feed')
  @UseGuards() // override class-level guards — public endpoint
  retirementFeed(): Observable<MessageEvent> {
    let lastSeenId: string | null = null;

    return interval(SSE_POLL_INTERVAL_MS).pipe(
      switchMap(() =>
        from(
          this.prisma.retirement.findMany({
            where: lastSeenId ? { id: { gt: lastSeenId } } : undefined,
            include: { credit: true, company: true },
            orderBy: { retiredAt: 'asc' },
            take: 50,
          }),
        ),
      ),
      map((retirements) => {
        if (retirements.length > 0) {
          lastSeenId = retirements[retirements.length - 1].id;
        }

        const events = retirements.map((r) => ({
          id: r.id,
          tokenId: r.creditId,
          retiringEntity: r.company.name,
          amount: r.amount,
          purpose: r.purpose,
          projectName: r.credit.projectName,
          transactionHash: r.transactionHash,
          retiredAt: r.retiredAt,
          contractId: process.env.RETIREMENT_TRACKER_CONTRACT_ID || '',
        }));

        return {
          data: JSON.stringify({ events, timestamp: new Date().toISOString() }),
          type: 'retirement',
        } as MessageEvent;
      }),
      catchError(() =>
        of({
          data: JSON.stringify({ error: 'Feed temporarily unavailable' }),
          type: 'error',
        } as MessageEvent),
      ),
    );
  }

  /**
   * GET /api/v1/public/retirements/recent
   * Recent retirement events (paginated). Public endpoint.
   */
  @Get('public/recent')
  @UseGuards() // public endpoint
  async getRecentRetirements(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const [retirements, total] = await Promise.all([
      this.prisma.retirement.findMany({
        include: { credit: true, company: true },
        orderBy: { retiredAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.retirement.count(),
    ]);

    return {
      data: retirements.map((r) => ({
        id: r.id,
        tokenId: r.creditId,
        retiringEntity: r.company.name,
        amount: r.amount,
        purpose: r.purpose,
        projectName: r.credit.projectName,
        transactionHash: r.transactionHash,
        retiredAt: r.retiredAt,
        contractId: process.env.RETIREMENT_TRACKER_CONTRACT_ID || '',
      })),
      meta: { total, page: Number(page), limit: take },
    };
  }

  // ── Existing single-retirement endpoints ──────────────────────────────────

  @Get(':id')
  @Permissions(CREDIT_VIEW)
  async getDetails(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const retirement = await this.prisma.retirement.findUnique({
      where: { id },
      include: { credit: true, company: true },
    });
    if (!retirement) throw new NotFoundException('Retirement not found');
    if (retirement.companyId !== user.companyId) {
      throw new NotFoundException('Retirement not found');
    }
    return retirement;
  }

  @Get(':id/certificate')
  @Permissions(CREDIT_VIEW)
  async downloadCertificate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const retirement = await this.prisma.retirement.findUnique({
      where: { id },
      include: { credit: true, company: true },
    });

    if (!retirement) throw new NotFoundException('Retirement not found');
    if (retirement.companyId !== user.companyId) {
      throw new NotFoundException('Retirement not found');
    }

    const certificateData = {
      certificateNumber: retirement.certificateId || `RET-${retirement.id}`,
      companyName: retirement.company.name,
      retirementDate: retirement.retiredAt,
      creditProject: retirement.credit.projectName,
      creditAmount: retirement.amount,
      creditPurpose: retirement.purpose,
      transactionHash: retirement.transactionHash,
      pdfUrl: `/api/v1/retirements/${retirement.id}/certificate`,
    };

    return this.certificateService.generateCertificate(certificateData, res);
  }
}
