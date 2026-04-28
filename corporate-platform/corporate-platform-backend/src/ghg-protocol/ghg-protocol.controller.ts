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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  CalculateEmissionDto,
  CreateEmissionSourceDto,
  RecordEmissionDto,
} from './dto/record-emission.dto';
import {
  EmissionFactorsQueryDto,
  EmissionSourceQueryDto,
  InventoryQueryDto,
  TrendsQueryDto,
} from './dto/inventory-query.dto';
import { GhgProtocolService } from './ghg-protocol.service';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  COMPLIANCE_SUBMIT,
  COMPLIANCE_VIEW,
  COMPLIANCE_VERIFY_RETIREMENT,
} from '../rbac/constants/permissions.constants';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import { CompanyId } from '../shared/decorators/company-id.decorator';

@ApiTags('GHG Protocol - Emissions & Offset Verification')
@ApiBearerAuth()
@Controller('api/v1/ghg')
@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
export class GhgProtocolController {
  constructor(private readonly ghgProtocolService: GhgProtocolService) {}

  @Post('emissions/record')
  @Permissions(COMPLIANCE_SUBMIT)
  recordEmission(
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordEmissionDto,
  ) {
    return this.ghgProtocolService.recordEmission(companyId, dto, user);
  }

  @Get('emissions/sources')
  @Permissions(COMPLIANCE_VIEW)
  listSources(
    @CompanyId() companyId: string,
    @Query() query: EmissionSourceQueryDto,
  ) {
    return this.ghgProtocolService.listSources(companyId, query);
  }

  @Post('emissions/sources')
  @Permissions(COMPLIANCE_SUBMIT)
  createSource(
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEmissionSourceDto,
  ) {
    return this.ghgProtocolService.createSource(companyId, dto, user);
  }

  @Get('emissions/inventory')
  @Permissions(COMPLIANCE_VIEW)
  getInventory(
    @CompanyId() companyId: string,
    @Query() query: InventoryQueryDto,
  ) {
    return this.ghgProtocolService.getInventory(companyId, query);
  }

  @Get('emissions/inventory/year/:year')
  @Permissions(COMPLIANCE_VIEW)
  getAnnualInventory(
    @CompanyId() companyId: string,
    @Param('year', ParseIntPipe) year: number,
  ) {
    return this.ghgProtocolService.getAnnualInventory(companyId, year);
  }

  @Get('emissions/trends')
  @Permissions(COMPLIANCE_VIEW)
  getTrends(@CompanyId() companyId: string, @Query() query: TrendsQueryDto) {
    return this.ghgProtocolService.getTrends(companyId, query);
  }

  @Get('factors')
  @Permissions(COMPLIANCE_VIEW)
  listFactors(@Query() query: EmissionFactorsQueryDto) {
    return this.ghgProtocolService.listFactors(query);
  }

  @Post('calculate')
  @Permissions(COMPLIANCE_SUBMIT)
  calculate(
    @CompanyId() companyId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CalculateEmissionDto,
  ) {
    return this.ghgProtocolService.calculate(companyId, dto, user);
  }

  @Post('verify-offsets')
  @Permissions(COMPLIANCE_VERIFY_RETIREMENT)
  @ApiOperation({
    summary: 'Verify carbon offsets for GHG Protocol compliance',
    description:
      'Validates that the specified tokens are properly retired on-chain and available for GHG Protocol offset claims. Prevents double-counting by checking claim history.',
  })
  @ApiResponse({ status: 200, description: 'Offset verification completed' })
  @ApiResponse({ status: 400, description: 'No tokens provided' })
  verifyOffsets(
    @CompanyId() companyId: string,
    @Body('tokenIds') tokenIds: string[],
  ) {
    return this.ghgProtocolService.verifyOffsetsForCompliance(
      companyId,
      tokenIds || [],
    );
  }
}
