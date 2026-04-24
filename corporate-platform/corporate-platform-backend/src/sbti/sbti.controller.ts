import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateTargetDto } from './dto/create-target.dto';
import { SbtiService } from './sbti.service';

@Controller('api/v1/sbti')
export class SbtiController {
  constructor(private readonly sbtiService: SbtiService) {}

  // POST /api/v1/sbti/targets - Create SBTi target
  @Post('targets')
  createTarget(@Body() dto: CreateTargetDto) {
    return this.sbtiService.createTarget(dto);
  }

  // GET /api/v1/sbti/targets - List company targets
  @Get('targets')
  listTargets(@Query('companyId') companyId: string) {
    return this.sbtiService.listTargets(companyId);
  }

  // GET /api/v1/sbti/targets/:id/progress - Get target progress
  @Get('targets/:id/progress')
  getTargetProgress(@Param('id', ParseUUIDPipe) id: string) {
    return this.sbtiService.getTargetProgress(id);
  }

  // POST /api/v1/sbti/targets/:id/validate - Validate against SBTi criteria
  @Post('targets/:id/validate')
  validateTarget(@Param('id', ParseUUIDPipe) id: string) {
    return this.sbtiService.validateTarget(id);
  }

  // GET /api/v1/sbti/dashboard - SBTi progress dashboard
  @Get('dashboard')
  getDashboard(@Query('companyId') companyId: string) {
    return this.sbtiService.getDashboard(companyId);
  }

  // GET /api/v1/sbti/retirement-gap - Calculate retirements needed
  @Get('retirement-gap')
  getRetirementGap(@Query('companyId') companyId: string) {
    return this.sbtiService.getRetirementGap(companyId);
  }
}
