import {
    Controller,
    Get,
    Patch,
    Param,
    Query,
    Body,
    UseGuards,
  } from '@nestjs/common';
  import { CreditService } from './credit.service';
  import { CreditQueryDto } from './dto/credit-query.dto';
  import { CreditUpdateDto } from './dto/credit-update.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
  
  @Controller('api/v1/credits')
  export class CreditController {
    constructor(private readonly creditService: CreditService) {}
  
    @Get()
    findAll(@Query() query: CreditQueryDto) {
      return this.creditService.findAll(query);
    }
  
    @Get('stats')
    getStats() {
      return this.creditService.getStats();
    }
  
    @Get('filters')
    getFilters() {
      return this.creditService.getFilters();
    }
  
    @Get('available')
    getAvailable(@Query('page') page?: number, @Query('limit') limit?: number) {
      return this.creditService.getAvailableOnly(page, limit);
    }
  
    @Get('comparison')
    compare(@Query('ids') ids: string) {
      const projectIds = ids ? ids.split(',') : [];
      return this.creditService.compareProjects(projectIds);
    }
  
    @Get(':id')
    findOne(@Param('id') id: string) {
      return this.creditService.findOne(id);
    }
  
    @Get(':id/quality')
    getQuality(@Param('id') id: string) {
      return this.creditService.getQualityMetrics(id);
    }
  
    @Patch(':id/status')
    @UseGuards(JwtAuthGuard)
    updateStatus(@Param('id') id: string, @Body() updateDto: CreditUpdateDto) {
      return this.creditService.updateStatus(id, updateDto);
    }
  }
  
