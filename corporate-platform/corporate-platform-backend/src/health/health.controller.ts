import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Liveness probe endpoint.
   * Returns HTTP 200 immediately if the application process is running.
   */
  @Get('liveness')
  getLiveness(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'corporate-platform-backend',
      liveness: 'up',
    });
  }

  /**
   * Readiness probe endpoint.
   * Verifies the availability of all external services in parallel.
   * Returns HTTP 200 if healthy, or HTTP 503 if any critical dependency is down.
   */
  @Get('readiness')
  async getReadiness(@Res() res: Response) {
    const result = await this.healthService.getReadiness();
    const statusCode =
      result.status === 'healthy'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json(result);
  }
}
