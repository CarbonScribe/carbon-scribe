import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { MethodologyMappingService } from '../services/methodology-mapping.service';
import { MappingRulesService } from '../services/mapping-rules.service';
import { CrossComplianceService } from '../services/cross-compliance.service';
import { CreateMappingDto, UpdateMappingDto } from '../dto/create-mapping.dto';
import { CreateMappingRuleDto } from '../dto/create-rule.dto';
import { ValidateMethodologyDto } from '../dto/validate-methodology.dto';
import { CrossComplianceReportQueryDto } from '../dto/cross-compliance-report.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('api/v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MethodologyMappingController {
  constructor(
    private readonly mappingService: MethodologyMappingService,
    private readonly rulesService: MappingRulesService,
    private readonly complianceService: CrossComplianceService,
  ) {}

  // --- Mapping Management ---

  @Post('frameworks/mappings')
  @Roles('admin')
  async createMapping(
    @Body() dto: CreateMappingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.mappingService.createMapping(dto, userId);
  }

  @Get('frameworks/mappings/methodology/:tokenId')
  async getMappingsForMethodology(
    @Param('tokenId', ParseIntPipe) tokenId: number,
  ) {
    return this.mappingService.getMappingsForMethodology(tokenId);
  }

  @Get('frameworks/:code/methodologies')
  async getMethodologiesForFramework(@Param('code') code: string) {
    return this.mappingService.getMethodologiesForFramework(code);
  }

  @Put('frameworks/mappings/:id')
  @Roles('admin')
  async updateMapping(
    @Param('id') id: string,
    @Body() dto: UpdateMappingDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.mappingService.updateMapping(id, dto, userId);
  }

  @Delete('frameworks/mappings/:id')
  @Roles('admin')
  async deleteMapping(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.mappingService.deleteMapping(id, userId);
  }

  // --- Auto-Mapping ---

  @Post('frameworks/mappings/auto/:methodologyId')
  @Roles('admin')
  async triggerAutoMapping(
    @Param('methodologyId') methodologyId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.mappingService.autoMapMethodology(methodologyId, userId);
  }

  @Post('frameworks/mappings/rules')
  @Roles('admin')
  async createRule(@Body() dto: CreateMappingRuleDto) {
    return this.rulesService.create(dto);
  }

  @Get('frameworks/mappings/rules')
  @Roles('admin')
  async listRules() {
    return this.rulesService.findAll();
  }

  // --- Cross-Compliance (Reporting & Validation) ---

  @Get('compliance/cross-report')
  async generateCrossReport(
    @Query() query: CrossComplianceReportQueryDto,
    @CurrentUser('companyId') companyId: string,
  ) {
    return this.complianceService.generateCrossComplianceReport(
      query.companyId || companyId,
      query.frameworkCodes,
    );
  }

  @Post('compliance/validate-methodology')
  async validateMethodology(@Body() dto: ValidateMethodologyDto) {
    return this.complianceService.validateMethodologyForFramework(
      dto.methodologyTokenId,
      dto.frameworkCode,
    );
  }
}
