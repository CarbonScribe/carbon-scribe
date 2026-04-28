import { Test, TestingModule } from '@nestjs/testing';
import { TeamCollaborationService } from './team-collaboration.service';
import { ActivityFeedService } from './services/activity-feed.service';
import { PerformanceMetricsService } from './services/performance-metrics.service';
import { CollaborationScoreService } from './services/collaboration-score.service';
import { MemberDetailsService } from './services/member-details.service';
import { NotificationsService } from './services/notifications.service';

describe('TeamCollaborationService', () => {
  let service: TeamCollaborationService;
  let activityFeedService: ActivityFeedService;
  let collaborationScoreService: CollaborationScoreService;
  let memberDetailsService: MemberDetailsService;
  let notificationsService: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamCollaborationService,
        {
          provide: ActivityFeedService,
          useValue: {
            getActivityFeed: jest.fn(),
            getRecentActivities: jest.fn(),
            getUserActivity: jest.fn(),
            getActivitySummary: jest.fn(),
            logActivity: jest.fn(),
          },
        },
        {
          provide: PerformanceMetricsService,
          useValue: {
            getTeamPerformance: jest.fn(),
            getMemberPerformance: jest.fn(),
          },
        },
        {
          provide: CollaborationScoreService,
          useValue: {
            getCollaborationScore: jest.fn(),
            getTopContributors: jest.fn(),
          },
        },
        {
          provide: MemberDetailsService,
          useValue: {
            getMemberProfile: jest.fn(),
            getActivityHistory: jest.fn(),
            getContributions: jest.fn(),
            getCollaborationPatterns: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            getUnreadNotifications: jest.fn(),
            markAsRead: jest.fn(),
            notifyTeamMemberJoined: jest.fn(),
            notifyRoleChange: jest.fn(),
            notifyTargetAchieved: jest.fn(),
            notifyCollaborationMilestone: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TeamCollaborationService>(TeamCollaborationService);
    activityFeedService = module.get<ActivityFeedService>(ActivityFeedService);
    collaborationScoreService = module.get<CollaborationScoreService>(
      CollaborationScoreService,
    );
    memberDetailsService =
      module.get<MemberDetailsService>(MemberDetailsService);
    notificationsService =
      module.get<NotificationsService>(NotificationsService);
  });

  describe('Activity Feed', () => {
    it('should get activity feed', async () => {
      const companyId = 'test-company';
      const query = { companyId, page: 1, limit: 20 };
      const expectedResult = {
        activities: [],
        total: 0,
        page: 1,
        hasMore: false,
      };

      jest
        .spyOn(activityFeedService, 'getActivityFeed')
        .mockResolvedValue(expectedResult);

      const result = await service.getActivityFeed(companyId, query);
      expect(result).toEqual(expectedResult);
      expect(activityFeedService.getActivityFeed).toHaveBeenCalledWith({
        ...query,
        companyId,
      });
    });

    it('should get recent activities', async () => {
      const companyId = 'test-company';
      const limit = 10;
      const expectedResult = [];

      jest
        .spyOn(activityFeedService, 'getRecentActivities')
        .mockResolvedValue(expectedResult);

      const result = await service.getRecentActivities(companyId, limit);
      expect(result).toEqual(expectedResult);
      expect(activityFeedService.getRecentActivities).toHaveBeenCalledWith(
        companyId,
        limit,
      );
    });
  });

  describe('Collaboration Score', () => {
    it('should get collaboration score', async () => {
      const companyId = 'test-company';
      const now = new Date();
      const query = { periodStart: now, periodEnd: now };
      const expectedResult = {
        companyId,
        periodStart: now,
        periodEnd: now,
        overallScore: 75,
        components: {
          communicationScore: 70,
          knowledgeSharingScore: 75,
          responseTimeScore: 80,
          meetingParticipationScore: 65,
          crossTeamCollaborationScore: 70,
          goalAlignmentScore: 85,
        },
        rating: 'GOOD' as any,
        insights: [],
        recommendations: [],
        history: [],
      };

      jest
        .spyOn(collaborationScoreService, 'getCollaborationScore')
        .mockResolvedValue(expectedResult);

      const result = await service.getCollaborationScore(companyId, query);
      expect(result).toEqual(expectedResult);
      expect(
        collaborationScoreService.getCollaborationScore,
      ).toHaveBeenCalledWith({ ...query, companyId });
    });

    it('should get top contributors', async () => {
      const companyId = 'test-company';
      const limit = 10;
      const expectedResult = [];

      jest
        .spyOn(collaborationScoreService, 'getTopContributors')
        .mockResolvedValue(expectedResult);

      const result = await service.getTopContributors(companyId, limit);
      expect(result).toEqual(expectedResult);
      expect(collaborationScoreService.getTopContributors).toHaveBeenCalledWith(
        companyId,
        limit,
      );
    });
  });

  describe('Member Details', () => {
    it('should get member profile', async () => {
      const companyId = 'test-company';
      const memberId = 'test-member';
      const expectedResult = {
        id: memberId,
        userId: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        title: null,
        department: null,
        roleId: 'role-123',
        roleName: 'Viewer',
        status: 'ACTIVE',
        joinedAt: new Date(),
        lastActiveAt: null,
        activityStats: {
          totalActions: 50,
          actionsThisWeek: 10,
          actionsThisMonth: 40,
          uniqueDaysActive: 15,
          averageActionsPerDay: 3.33,
          topActivityTypes: [{ type: 'LOGIN', count: 20 }],
        },
        expertiseAreas: ['Reporting'],
      };

      jest
        .spyOn(memberDetailsService, 'getMemberProfile')
        .mockResolvedValue(expectedResult);

      const result = await service.getMemberProfile(companyId, memberId);
      expect(result).toEqual(expectedResult);
      expect(memberDetailsService.getMemberProfile).toHaveBeenCalledWith(
        companyId,
        memberId,
      );
    });
  });

  describe('Notifications', () => {
    it('should get unread notifications', async () => {
      const companyId = 'test-company';
      const userId = 'user-123';
      const expectedResult = [];

      jest
        .spyOn(notificationsService, 'getUnreadNotifications')
        .mockResolvedValue(expectedResult);

      const result = await service.getUnreadNotifications(companyId, userId);
      expect(result).toEqual(expectedResult);
      expect(notificationsService.getUnreadNotifications).toHaveBeenCalledWith(
        companyId,
        userId,
      );
    });

    it('should send team member joined notification', async () => {
      const companyId = 'test-company';
      const email = 'new@example.com';
      const name = 'Jane Doe';

      jest
        .spyOn(notificationsService, 'notifyTeamMemberJoined')
        .mockResolvedValue();

      await service.notifyTeamMemberJoined(companyId, email, name);
      expect(notificationsService.notifyTeamMemberJoined).toHaveBeenCalledWith(
        companyId,
        email,
        name,
      );
    });
  });
});
