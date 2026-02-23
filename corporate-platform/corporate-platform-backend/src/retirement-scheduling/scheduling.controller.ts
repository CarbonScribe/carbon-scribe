import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BatchRetirementDto } from './dto/batch-retirement.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulingService } from './scheduling.service';

@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class SchedulingController {
  constructor(private readonly schedulingService: SchedulingService) {}

  @Post('retirement-schedules')
  createSchedule(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.schedulingService.createSchedule(user.companyId, user.sub, dto);
  }

  @Get('retirement-schedules')
  listSchedules(@CurrentUser() user: JwtPayload) {
    return this.schedulingService.listSchedules(user.companyId);
  }

  @Get('retirement-schedules/:id')
  getSchedule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schedulingService.getSchedule(user.companyId, id);
  }

  @Patch('retirement-schedules/:id')
  updateSchedule(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulingService.updateSchedule(user.companyId, id, dto);
  }

  @Delete('retirement-schedules/:id')
  deleteSchedule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schedulingService.deleteSchedule(user.companyId, id);
  }

  @Post('retirement-schedules/:id/pause')
  pauseSchedule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schedulingService.pauseSchedule(user.companyId, id);
  }

  @Post('retirement-schedules/:id/resume')
  resumeSchedule(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schedulingService.resumeSchedule(user.companyId, id);
  }

  @Post('retirement-schedules/:id/execute-now')
  executeNow(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schedulingService.executeScheduleNow(user.companyId, id);
  }

  @Get('retirement-schedules/:id/executions')
  getExecutions(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schedulingService.listExecutions(user.companyId, id);
  }

  @Post('retirement-batches')
  createBatch(@CurrentUser() user: JwtPayload, @Body() dto: BatchRetirementDto) {
    return this.schedulingService.createBatch(user.companyId, user.sub, dto);
  }

  @Post('retirement-batches/csv')
  @UseInterceptors(FileInterceptor('file'))
  createBatchFromCsv(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: any,
    @Body('name') name: string,
    @Body('description') description?: string,
  ) {
    const csvContent = file?.buffer?.toString('utf-8') || '';
    return this.schedulingService.createBatchFromCsv(
      user.companyId,
      user.sub,
      name,
      description,
      csvContent,
    );
  }

  @Get('retirement-batches')
  listBatches(@CurrentUser() user: JwtPayload) {
    return this.schedulingService.listBatches(user.companyId);
  }

  @Get('retirement-batches/:id')
  getBatch(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.schedulingService.getBatch(user.companyId, id);
  }
}
