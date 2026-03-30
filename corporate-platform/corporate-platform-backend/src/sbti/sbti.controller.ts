import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SbtiService } from './sbti.service';
import { CreateTargetDto } from './dto/create-target.dto';
import { ProgressQueryDto } from './dto/progress-query.dto';
import { CompanyId } from '../shared/decorators/company-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  COMPLIANCE_SUBMIT,
  COMPLIANCE_VIEW,
} from '../rbac/constants/permissions.constants';

@Controller('api/v1/sbti')
@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
export class SbtiController {
  constructor(private readonly sbtiService: SbtiService) {}

  @Post('targets')
  @Permissions(COMPLIANCE_SUBMIT)
  createTarget(
    @CompanyId() companyId: string,
    @Body() dto: CreateTargetDto,
  ) {
    return this.sbtiService.createTarget(companyId, dto);
  }

  @Get('targets')
  @Permissions(COMPLIANCE_VIEW)
  listTargets(@CompanyId() companyId: string) {
    return this.sbtiService.listTargets(companyId);
  }

  @Get('targets/:id/progress')
  @Permissions(COMPLIANCE_VIEW)
  getTargetProgress(
    @CompanyId() companyId: string,
    @Param('id') targetId: string,
    @Query() query: ProgressQueryDto,
  ) {
    return this.sbtiService.getTargetProgress(companyId, targetId, query);
  }

  @Post('targets/:id/validate')
  @Permissions(COMPLIANCE_SUBMIT)
  validateTarget(
    @CompanyId() companyId: string,
    @Param('id') targetId: string,
  ) {
    return this.sbtiService.validateTarget(companyId, targetId);
  }

  @Get('dashboard')
  @Permissions(COMPLIANCE_VIEW)
  getDashboard(@CompanyId() companyId: string) {
    return this.sbtiService.getDashboard(companyId);
  }

  @Get('retirement-gap')
  @Permissions(COMPLIANCE_VIEW)
  getRetirementGap(@CompanyId() companyId: string) {
    return this.sbtiService.getRetirementGap(companyId);
  }

  @Get('submission')
  @Permissions(COMPLIANCE_SUBMIT)
  getSubmissionPackage(@CompanyId() companyId: string) {
    return this.sbtiService.getSubmissionPackage(companyId);
  }
}
