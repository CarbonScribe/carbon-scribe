import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { RetirementHistoryService } from './retirement-history.service';
import { ComplianceFramework } from '../types/compliance-framework.enum';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/guards/permissions.guard';
import { Permissions } from '../../rbac/decorators/permissions.decorator';
import { COMPLIANCE_VIEW } from '../../rbac/constants/permissions.constants';
import { SecurityService } from '../../security/security.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/compliance/retirements')
export class RetirementHistoryController {
  constructor(
    private readonly retirementHistoryService: RetirementHistoryService,
    private readonly securityService: SecurityService,
  ) {}

  @Get()
  @Permissions(COMPLIANCE_VIEW)
  async queryRetirements(
    @Query('entity') entity?: string,
    @Query('tokenId') tokenId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('framework') framework?: ComplianceFramework,
    @Query('assetType') assetType?: string,
    @Query('project') project?: string,
    @Req() req?: any,
  ) {
    await this.securityService.logEvent?.({
      eventType: 'report.exported',
      userId: req?.user?.id,
      details: {
        entity,
        tokenId,
        dateFrom,
        dateTo,
        framework,
        assetType,
        project,
      },
      ipAddress: req?.ip,
      severity: 'info',
      status: 'success',
    });
    return this.retirementHistoryService.queryRetirements({
      entity,
      tokenId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      framework,
      assetType,
      project,
    });
  }

  @Get(':tokenId')
  @Permissions(COMPLIANCE_VIEW)
  async getRetirementByToken(
    @Param('tokenId') tokenId: string,
    @Query('framework') framework?: ComplianceFramework,
    @Req() req?: any,
  ) {
    await this.securityService.logEvent?.({
      eventType: 'report.exported',
      userId: req?.user?.id,
      details: { tokenId, framework },
      ipAddress: req?.ip,
      severity: 'info',
      status: 'success',
    });
    return this.retirementHistoryService.getRetirementByToken(
      tokenId,
      framework,
    );
  }

  @Get('entity/:address')
  @Permissions(COMPLIANCE_VIEW)
  async listRetirementsByEntity(
    @Param('address') address: string,
    @Query('framework') framework?: ComplianceFramework,
    @Req() req?: any,
  ) {
    await this.securityService.logEvent?.({
      eventType: 'report.exported',
      userId: req?.user?.id,
      details: { address, framework },
      ipAddress: req?.ip,
      severity: 'info',
      status: 'success',
    });
    return this.retirementHistoryService.listRetirementsByEntity(
      address,
      framework,
    );
  }
}
