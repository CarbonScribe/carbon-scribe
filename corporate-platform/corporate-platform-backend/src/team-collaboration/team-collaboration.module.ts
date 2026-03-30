import { Module } from '@nestjs/common';
import { TeamCollaborationController } from './team-collaboration.controller';
import { TeamCollaborationService } from './team-collaboration.service';
import { ActivityFeedService } from './services/activity-feed.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';
import { CollaborationScoreService } from './services/collaboration-score.service';
import { MemberDetailsService } from './services/member-details.service';
import { NotificationsService } from './services/notifications.service';
import { ActivityGateway } from './gateways/activity.gateway';
import { PrismaService } from '../shared/database/prisma.service';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [CacheModule],
  controllers: [TeamCollaborationController],
  providers: [
    TeamCollaborationService,
    ActivityFeedService,
    PerformanceMetricsService,
    CollaborationScoreService,
    MemberDetailsService,
    NotificationsService,
    ActivityGateway,
    PrismaService,
  ],
  exports: [TeamCollaborationService],
})
export class TeamCollaborationModule {}
