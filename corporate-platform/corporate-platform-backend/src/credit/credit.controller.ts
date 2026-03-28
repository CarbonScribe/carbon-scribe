import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditQueryDto } from './dto/credit-query.dto';
import { CreditUpdateDto } from './dto/credit-update.dto';
import { Tenant } from '../multi-tenant/decorators/tenant.decorator';
import { TenantContext } from '../multi-tenant/interfaces/tenant-context.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/credits')
export class CreditController {
  constructor(private readonly service: CreditService) {}

  @Get()
  async list(@Query() query: CreditQueryDto, @Tenant() tenant?: TenantContext) {
    return this.service.list(query, tenant?.companyId);
  }

  @Get('available')
  async available(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Tenant() tenant?: TenantContext,
  ) {
    return this.service.listAvailable(
      Number(page),
      Number(limit),
      tenant?.companyId,
    );
  }

  @Get('filters')
  async filters() {
    // return available filter options
    return {
      methodologies: await Promise.resolve([]),
      countries: await Promise.resolve([]),
      vintages: await Promise.resolve([]),
    };
  }

  @Get('stats')
  async stats() {
    return this.service.stats();
  }

  @Get('comparison')
  async comparison(
    @Query('projectIds') projectIds: string,
    @Tenant() tenant?: TenantContext,
  ) {
    const ids = projectIds ? projectIds.split(',') : [];
    return this.service.compare(ids, tenant?.companyId);
  }

  @Get(':id')
  async get(@Param('id') id: string, @Tenant() tenant?: TenantContext) {
    return this.service.getById(id, tenant?.companyId);
  }

  @Get(':id/quality')
  async quality(@Param('id') id: string, @Tenant() tenant?: TenantContext) {
    return this.service.getQuality(id, tenant?.companyId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: CreditUpdateDto,
    @Tenant() tenant?: TenantContext,
  ) {
    return this.service.updateStatus(
      id,
      dto.status,
      dto.availableAmount,
      tenant?.companyId,
    );
  }
}
