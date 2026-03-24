import { Controller, Get, Query, Param, Patch, Body } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditQueryDto } from './dto/credit-query.dto';
import { CreditUpdateDto } from './dto/credit-update.dto';

@Controller('api/v1/credits')
export class CreditController {
  constructor(private readonly service: CreditService) {}

  @Get()
  async list(@Query() query: CreditQueryDto) {
    return this.service.list(query);
  }

  @Get('available')
  async available(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.service.listAvailable(Number(page), Number(limit));
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
  async comparison(@Query('projectIds') projectIds: string) {
    const ids = projectIds ? projectIds.split(',') : [];
    return this.service.compare(ids);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Get(':id/quality')
  async quality(@Param('id') id: string) {
    return this.service.getQuality(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: CreditUpdateDto) {
    return this.service.updateStatus(id, dto.status, dto.availableAmount);
  }
}
