import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { IpfsMetricsService } from './ipfs-metrics.service';

/**
 * Scrapeable Prometheus endpoint for IPFS metrics (#735). Deliberately
 * unauthenticated (own controller, no JwtAuthGuard) — matching the
 * unauthenticated /health endpoint — since Prometheus scrapers typically
 * can't participate in the app's JWT auth flow.
 */
@Controller('api/v1/ipfs/metrics')
export class IpfsMetricsController {
  constructor(private readonly metrics: IpfsMetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    const body = await this.metrics.getMetricsText();
    res.setHeader('Content-Type', this.metrics.contentType);
    res.setHeader('Cache-Control', 'no-store');
    res.send(body);
  }
}
