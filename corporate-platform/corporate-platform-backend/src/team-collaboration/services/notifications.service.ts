import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../cache/redis.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly redis: RedisService) {}

  async publishTeamAlert(input: {
    companyId: string;
    type: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      const client: any = this.redis.getClient();
      if (!client || !this.redis.isHealthy()) {
        return;
      }
      await client.publish(
        `team-notifications:${input.companyId}`,
        JSON.stringify({
          type: input.type,
          message: input.message,
          metadata: input.metadata ?? {},
          timestamp: new Date().toISOString(),
        }),
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn(message);
    }
  }
}

