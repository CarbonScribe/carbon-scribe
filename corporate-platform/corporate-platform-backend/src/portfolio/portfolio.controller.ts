import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioQueryDto } from './dto/portfolio-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { PORTFOLIO_VIEW } from '../rbac/constants/permissions.constants';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { SecurityService } from '../security/security.service';
import { SecurityEvents } from '../security/constants/security-events.constants';

@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
@Controller('api/v1/portfolio')
export class PortfolioController {
  constructor(
    private portfolioService: PortfolioService,
    private securityService: SecurityService,
  ) {}

  @Get('/summary')
  @Permissions(PORTFOLIO_VIEW)
  async getSummary(@CurrentUser() user: JwtPayload) {
    const companyId = user.companyId;
    const result = await this.portfolioService.getPortfolioSummary(companyId);

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      userId: user.sub,
      resource: '/api/v1/portfolio/summary',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('/performance')
  @Permissions(PORTFOLIO_VIEW)
  async getPerformance(@CurrentUser() user: JwtPayload) {
    const companyId = user.companyId;
    const result =
      await this.portfolioService.getPortfolioPerformance(companyId);

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      userId: user.sub,
      resource: '/api/v1/portfolio/performance',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('/composition')
  @Permissions(PORTFOLIO_VIEW)
  async getComposition(@CurrentUser() user: JwtPayload) {
    const companyId = user.companyId;
    const result =
      await this.portfolioService.getPortfolioComposition(companyId);

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      userId: user.sub,
      resource: '/api/v1/portfolio/composition',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('/timeline')
  @Permissions(PORTFOLIO_VIEW)
  async getTimeline(
    @CurrentUser() user: JwtPayload,
    @Query() query: PortfolioQueryDto,
  ) {
    const companyId = user.companyId;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (query.startDate) {
      startDate = new Date(query.startDate);
      if (isNaN(startDate.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
    }

    if (query.endDate) {
      endDate = new Date(query.endDate);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
    }

    const result = await this.portfolioService.getPortfolioTimeline(
      companyId,
      startDate,
      endDate,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      userId: user.sub,
      resource: '/api/v1/portfolio/timeline',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('/risk')
  @Permissions(PORTFOLIO_VIEW)
  async getRisk(@CurrentUser() user: JwtPayload) {
    const companyId = user.companyId;
    const result = await this.portfolioService.getPortfolioRisk(companyId);

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      userId: user.sub,
      resource: '/api/v1/portfolio/risk',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('/holdings')
  @Permissions(PORTFOLIO_VIEW)
  async getHoldings(
    @CurrentUser() user: JwtPayload,
    @Query() query: PortfolioQueryDto,
  ) {
    const companyId = user.companyId;
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;

    const result = await this.portfolioService.getPortfolioHoldings(
      companyId,
      page,
      pageSize,
    );

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      userId: user.sub,
      resource: '/api/v1/portfolio/holdings',
      method: 'GET',
      status: 'success',
      statusCode: 200,
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }

  @Get('/analytics')
  @Permissions(PORTFOLIO_VIEW)
  async getAnalytics(@CurrentUser() user: JwtPayload) {
    const companyId = user.companyId;
    const result = await this.portfolioService.getPortfolioAnalytics(companyId);

    await this.securityService.logEvent({
      eventType: SecurityEvents.ReportExported,
      companyId,
      userId: user.sub,
      resource: '/api/v1/portfolio/analytics',
      method: 'GET',
      status: 'success',
      statusCode: 200,
      details: {
        analyticsType: 'full_dashboard',
      },
    });

    return {
      success: true,
      data: result,
      timestamp: new Date(),
    };
  }
}
