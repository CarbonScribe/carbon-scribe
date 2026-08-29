import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { OutboxService, OutboxStatus } from './outbox.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';

@Controller('admin/outbox')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class OutboxController {
  constructor(private readonly outboxService: OutboxService) {}

  @Get()
  inspect(@Query('status') status?: OutboxStatus) {
    return this.outboxService.inspect(status);
  }

  @Get('metrics')
  metrics() {
    return this.outboxService.getMetrics();
  }

  @Post('replay')
  replay(@Body('id') id?: string) {
    return this.outboxService.replayFailed(id);
  }
}
