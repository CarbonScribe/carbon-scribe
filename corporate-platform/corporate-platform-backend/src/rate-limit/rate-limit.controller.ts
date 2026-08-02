import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';

@Controller('internal/rate-limit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class RateLimitController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  /**
   * Get rate limit metrics for an endpoint
   */
  @Get('metrics/:endpoint')
  async getMetrics(@Param('endpoint') endpoint: string) {
    return this.rateLimitService.getMetrics(endpoint);
  }

  /**
   * Get rate limit status for a specific key
   */
  @Get('status/:key')
  async getStatus(@Param('key') key: string, @Query('prefix') prefix: string) {
    const client = this.rateLimitService['redisService'].getClient();
    const redisKey = `rate-limit:${prefix || 'default'}:${key}`;

    try {
      const [count, ttl] = await Promise.all([
        client.get(redisKey),
        client.ttl(redisKey),
      ]);

      return {
        key: redisKey,
        count: parseInt(count || '0', 10),
        ttl: ttl > 0 ? ttl : 0,
        resetTime:
          ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
      };
    } catch {
      return {
        key: redisKey,
        error: 'Failed to get rate limit status',
      };
    }
  }

  /**
   * Reset rate limit for a specific key
   */
  @Delete('reset/:key')
  async resetRateLimit(
    @Param('key') key: string,
    @Query('prefix') prefix: string,
  ) {
    await this.rateLimitService.resetRateLimit(key, prefix || 'default');
    return { success: true, message: `Rate limit reset for key: ${key}` };
  }

  /**
   * Get all rate limit violations
   */
  @Get('violations/:endpoint')
  async getViolations(@Param('endpoint') endpoint: string) {
    const client = this.rateLimitService['redisService'].getClient();
    const violationKey = `rate-limit:violations:${endpoint}`;

    try {
      const violations = await client.lrange(violationKey, 0, 99);
      return violations.map((v: string) => JSON.parse(v));
    } catch {
      return [];
    }
  }
}
