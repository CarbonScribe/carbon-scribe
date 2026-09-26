import { Controller, Get, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { EventValidatorService } from './event-validator.service';

@Controller('internal/event-validation')
export class EventValidatorController {
  constructor(private readonly validator: EventValidatorService) {}

  /**
   * Get validation metrics
   */
  @Get('metrics')
  getMetrics() {
    return this.validator.getMetrics();
  }

  /**
   * Reset validation metrics
   */
  @Delete('metrics')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetMetrics() {
    this.validator.resetMetrics();
  }
}
