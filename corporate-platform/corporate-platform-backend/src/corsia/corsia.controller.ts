import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CorsiaService } from './corsia.service';
import { RecordFlightDto } from './dto/record-flight.dto';
import { ComplianceYearDto } from './dto/compliance-year.dto';
import { CompanyId } from '../shared/decorators/company-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  COMPLIANCE_SUBMIT,
  COMPLIANCE_VIEW,
} from '../rbac/constants/permissions.constants';

@ApiTags('CORSIA - Aviation Offset Compliance')
@ApiBearerAuth()
@Controller('api/v1/corsia')
@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
export class CorsiaController {
  constructor(private readonly corsiaService: CorsiaService) {}

  @Post('flights/record')
  @Permissions(COMPLIANCE_SUBMIT)
  recordFlight(@CompanyId() companyId: string, @Body() dto: RecordFlightDto) {
    return this.corsiaService.recordFlight(companyId, dto);
  }

  @Post('flights/batch')
  @Permissions(COMPLIANCE_SUBMIT)
  recordFlightsBatch(
    @CompanyId() companyId: string,
    @Body('flights') flights: RecordFlightDto[],
  ) {
    return this.corsiaService.recordFlightsBatch(companyId, flights || []);
  }

  @Get('flights')
  @Permissions(COMPLIANCE_VIEW)
  listFlights(
    @CompanyId() companyId: string,
    @Query() query: Partial<ComplianceYearDto>,
  ) {
    return this.corsiaService.listFlights(companyId, query.year);
  }

  @Get('emissions/year/:year')
  @Permissions(COMPLIANCE_VIEW)
  getAnnualEmissions(
    @CompanyId() companyId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.corsiaService.getAnnualEmissions(companyId, year);
  }

  @Get('offset-requirement/:year')
  @Permissions(COMPLIANCE_VIEW)
  getOffsetRequirement(
    @CompanyId() companyId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.corsiaService.calculateOffsetRequirement(companyId, year);
  }

  @Get('compliance/:year')
  @Permissions(COMPLIANCE_VIEW)
  getComplianceStatus(
    @CompanyId() companyId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.corsiaService.getComplianceStatus(companyId, year);
  }

  @Post('credits/validate')
  @Permissions(COMPLIANCE_SUBMIT)
  @ApiOperation({
    summary: 'Validate CORSIA-eligible credits with retirement verification',
    description:
      'Validates that the specified retirement IDs correspond to on-chain retired credits eligible for CORSIA compliance. Runs retirement verification against the Soroban Retirement Tracker contract to prevent double-counting.',
  })
  @ApiResponse({ status: 200, description: 'Credit validation results' })
  @ApiResponse({ status: 400, description: 'No retirement IDs provided' })
  validateCredits(
    @CompanyId() companyId: string,
    @Body('retirementIds') retirementIds: string[],
  ) {
    return this.corsiaService.validateCredits(companyId, retirementIds || []);
  }

  @Get('credits/eligible')
  @Permissions(COMPLIANCE_VIEW)
  listEligibleCredits(
    @CompanyId() companyId: string,
    @Query('year') year?: string,
  ) {
    return this.corsiaService.listEligibleCredits(
      companyId,
      year ? Number(year) : undefined,
    );
  }

  @Post('reports/generate')
  @Permissions(COMPLIANCE_SUBMIT)
  generateReport(
    @CompanyId() companyId: string,
    @Body() dto: ComplianceYearDto,
  ) {
    return this.corsiaService.generateReport(companyId, dto.year);
  }

  @Get('eligible-fuels')
  @Permissions(COMPLIANCE_VIEW)
  listEligibleFuels() {
    return this.corsiaService.listEligibleFuels();
  }
}
