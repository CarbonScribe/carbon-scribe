import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { VerifyIntegrityDto } from './dto/verify-integrity.dto';
import { AuditTrailService } from './audit-trail.service';

@Controller('api/v1/audit-trail')
@UseGuards(JwtAuthGuard)
export class AuditTrailController {
  constructor(private readonly auditTrailService: AuditTrailService) {}

  @Get('events')
  async queryEvents(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryAuditLogsDto,
  ) {
    return this.auditTrailService.queryEvents(user.companyId, query);
  }

  @Get('events/:id')
  async getEventById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.auditTrailService.getEventById(user.companyId, id);
  }

  @Get('entity/:entityType/:entityId')
  async getEntityTrail(
    @CurrentUser() user: JwtPayload,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditTrailService.getEntityTrail(
      user.companyId,
      entityType,
      entityId,
    );
  }

  @Get('verify/:id')
  async verifyEvent(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.auditTrailService.verifyEventIntegrity(user.companyId, id);
  }

  @Post('verify/batch')
  async verifyBatch(
    @CurrentUser() user: JwtPayload,
    @Body() body: VerifyIntegrityDto,
  ) {
    return this.auditTrailService.verifyBatchIntegrity(
      user.companyId,
      body.ids,
    );
  }

  @Get('chain/integrity')
  async verifyChain(@CurrentUser() user: JwtPayload) {
    return this.auditTrailService.verifyChainIntegrity(user.companyId);
  }

  @Post('anchor')
  async anchor(@CurrentUser() user: JwtPayload) {
    return this.auditTrailService.anchor(user.companyId);
  }

  @Get('export')
  async export(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryAuditLogsDto,
    @Res() res: Response,
  ) {
    const format = (query.format || 'csv').toLowerCase();
    const result = await this.auditTrailService.exportEvents(
      user.companyId,
      query,
    );

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=audit-events.json',
      );
      res.send(JSON.stringify(result.events));
      return;
    }

    const rows = result.events.map((event) => ({
      id: event.id,
      companyId: event.companyId,
      userId: event.userId,
      eventType: event.eventType,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      hash: event.hash,
      previousHash: event.previousHash,
      transactionHash: event.transactionHash || '',
      blockNumber: event.blockNumber ?? '',
      timestamp: event.timestamp.toISOString(),
    }));

    const csv = stringify(rows, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=audit-events.csv',
    );
    res.send(csv);
  }

  @Post('events')
  async createEvent(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateAuditLogDto,
  ) {
    return this.auditTrailService.createAuditEvent(
      user.companyId,
      user.sub,
      body,
      {},
    );
  }
}
