import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CsrdService } from './csrd.service';
import { CreateMaterialityAssessmentDto } from './dto/assessment.dto';
import {
  DisclosureQueryDto,
  RecordDisclosureDto,
} from './dto/disclosure-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  COMPLIANCE_VIEW,
  COMPLIANCE_SUBMIT,
  COMPLIANCE_VERIFY_RETIREMENT,
} from '../rbac/constants/permissions.constants';
import { CompanyId } from '../shared/decorators/company-id.decorator';

@ApiTags('CSRD - EU Corporate Sustainability Reporting')
@ApiBearerAuth()
@Controller('api/v1/csrd')
@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
export class CsrdController {
  constructor(private readonly csrdService: CsrdService) {}

  @Post('materiality/assess')
  @Permissions(COMPLIANCE_SUBMIT)
  async assessMateriality(
    @CompanyId() companyId: string,
    @Body() dto: CreateMaterialityAssessmentDto,
  ) {
    return this.csrdService.assessMateriality(companyId, dto);
  }

  @Get('materiality/current')
  @Permissions(COMPLIANCE_VIEW)
  async getCurrentMateriality(@CompanyId() companyId: string) {
    return this.csrdService.getCurrentMateriality(companyId);
  }

  @Post('disclosures/record')
  @Permissions(COMPLIANCE_SUBMIT)
  async recordDisclosure(
    @CompanyId() companyId: string,
    @Body() dto: RecordDisclosureDto,
  ) {
    return this.csrdService.recordDisclosure(companyId, dto);
  }

  @Get('disclosures')
  @Permissions(COMPLIANCE_VIEW)
  async listDisclosures(
    @CompanyId() companyId: string,
    @Query() query: DisclosureQueryDto,
  ) {
    return this.csrdService.listDisclosures(companyId, query);
  }

  @Get('disclosures/requirements')
  @Permissions(COMPLIANCE_VIEW)
  async getRequirements(@Query('standard') standard: string) {
    return this.csrdService.getRequirements(standard);
  }

  @Post('reports/generate')
  @Permissions(COMPLIANCE_SUBMIT)
  async generateReport(
    @CompanyId() companyId: string,
    @Body('year') year: number,
  ) {
    return this.csrdService.generateReport(companyId, year);
  }

  @Get('reports')
  @Permissions(COMPLIANCE_VIEW)
  async listReports(@CompanyId() companyId: string) {
    return this.csrdService.listReports(companyId);
  }

  @Get('readiness')
  @Permissions(COMPLIANCE_VIEW)
  async getReadiness(@CompanyId() companyId: string) {
    return this.csrdService.getReadinessScorecard(companyId);
  }

  @Post('verify-offsets')
  @Permissions(COMPLIANCE_VERIFY_RETIREMENT)
  @ApiOperation({
    summary: 'Verify carbon offsets for CSRD compliance',
    description:
      'Validates that the specified tokens are properly retired on-chain and available for CSRD offset claims. Prevents double-counting by checking claim history across frameworks.',
  })
  @ApiResponse({ status: 200, description: 'Offset verification completed' })
  @ApiResponse({ status: 400, description: 'No tokens provided' })
  async verifyOffsets(
    @CompanyId() companyId: string,
    @Body('tokenIds') tokenIds: string[],
  ) {
    return this.csrdService.verifyOffsetsForCompliance(
      companyId,
      tokenIds || [],
    );
  }
}
