import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SecurityService } from './security.service';
import { stringify } from 'csv-stringify/sync';

class CreateWhitelistDto {
  cidr: string;
  description?: string;
}

class AuditLogQueryDto {
  userId?: string;
  eventType?: string;
  severity?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@UseGuards(JwtAuthGuard)
@Controller('api/v1/security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('whitelist')
  async listWhitelist(@CurrentUser() user: JwtPayload) {
    this.ensureAdmin(user);
    return this.securityService.listWhitelist(user.companyId);
  }

  @Post('whitelist')
  async addWhitelist(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateWhitelistDto,
  ) {
    this.ensureAdmin(user);
    return this.securityService.addWhitelist(
      user.companyId,
      user.sub,
      body.cidr,
      body.description,
    );
  }

  @Delete('whitelist/:id')
  async removeWhitelist(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    this.ensureAdmin(user);
    return this.securityService.removeWhitelist(id, user.companyId, user.sub);
  }

  @Get('audit-logs')
  async getAuditLogs(
    @CurrentUser() user: JwtPayload,
    @Query() query: AuditLogQueryDto,
  ) {
    this.ensureAuditorOrAdmin(user);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    return this.securityService.queryAuditLogs({
      companyId: user.companyId,
      userId: query.userId,
      eventType: query.eventType,
      severity: query.severity,
      status: query.status,
      from,
      to,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get('audit-logs/export')
  async exportAuditLogs(
    @CurrentUser() user: JwtPayload,
    @Query() query: AuditLogQueryDto,
    @Res() res: Response,
  ) {
    this.ensureAuditorOrAdmin(user);
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    const { data } = await this.securityService.queryAuditLogs({
      companyId: user.companyId,
      userId: query.userId,
      eventType: query.eventType,
      severity: query.severity,
      status: query.status,
      from,
      to,
      page: 1,
      limit: 10000,
    });

    const rows = data.map((log) => ({
      ID: log.id,
      CompanyId: log.companyId || '',
      UserId: log.userId || '',
      EventType: log.eventType,
      Severity: log.severity,
      Status: log.status,
      StatusCode: log.statusCode ?? '',
      Timestamp: log.timestamp.toISOString(),
      IpAddress: log.ipAddress || '',
      UserAgent: log.userAgent || '',
      Resource: log.resource || '',
      Method: log.method || '',
    }));

    const csv = stringify(rows, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
    res.send(csv);
  }

  @Get('events/summary')
  async getSummary(@CurrentUser() user: JwtPayload) {
    this.ensureAdmin(user);
    return this.securityService.getSummary(user.companyId);
  }

  private ensureAdmin(user: JwtPayload) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
  }

  private ensureAuditorOrAdmin(user: JwtPayload) {
    if (user.role !== 'admin' && user.role !== 'auditor') {
      throw new ForbiddenException('Auditor or admin access required');
    }
  }
}
