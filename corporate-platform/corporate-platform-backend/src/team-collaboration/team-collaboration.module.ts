import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CacheModule } from '../cache/cache.module';
import { TeamCollaborationController } from './team-collaboration.controller';
import { TeamCollaborationService } from './team-collaboration.service';
import { ActivityFeedService } from './services/activity-feed.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';
import { CollaborationScoreService } from './services/collaboration-score.service';
import { MemberDetailsService } from './services/member-details.service';
import { NotificationsService } from './services/notifications.service';
import { ActivityLiveGateway } from './services/activity-live.gateway';

@Module({
  imports: [
    CacheModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-jwt-secret',
    }),
  ],
  controllers: [TeamCollaborationController],
  providers: [
    TeamCollaborationService,
    ActivityFeedService,
    PerformanceMetricsService,
    CollaborationScoreService,
    MemberDetailsService,
    NotificationsService,
    ActivityLiveGateway,
  ],
  exports: [TeamCollaborationService],
})
export class TeamCollaborationModule {}

