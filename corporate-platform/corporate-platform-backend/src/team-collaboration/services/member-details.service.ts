import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TeamActivity } from '../interfaces/team-activity.interface';

export interface MemberProfile {
  id: string;
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  department: string | null;
  roleId: string;
  roleName: string;
  status: string;
  joinedAt: Date;
  lastActiveAt: Date | null;
  activityStats: ActivityStats;
  expertiseAreas: string[];
}

export interface ActivityStats {
  totalActions: number;
  actionsThisWeek: number;
  actionsThisMonth: number;
  uniqueDaysActive: number;
  averageActionsPerDay: number;
  topActivityTypes: Array<{ type: string; count: number }>;
}

@Injectable()
export class MemberDetailsService {
  private readonly logger = new Logger(MemberDetailsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getMemberProfile(
    companyId: string,
    memberId: string,
  ): Promise<MemberProfile> {
    const member = await (this.prisma as any).teamMember.findFirst({
      where: { id: memberId, companyId },
      include: {
        role: true,
        user: true,
      },
    });

    if (!member) {
      throw new NotFoundException('Team member not found');
    }

    const activityStats = await this.getActivityStats(companyId, member.userId);
    const expertiseAreas = this.identifyExpertiseAreas(
      companyId,
      member.userId,
      activityStats.topActivityTypes,
    );

    return {
      id: member.id,
      userId: member.userId,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      title: member.title,
      department: member.department,
      roleId: member.roleId,
      roleName: member.role.name,
      status: member.status,
      joinedAt: member.joinedAt,
      lastActiveAt: member.lastActiveAt,
      activityStats,
      expertiseAreas,
    };
  }

  async getActivityHistory(
    companyId: string,
    userId: string,
    limit = 50,
    page = 1,
  ): Promise<{ activities: TeamActivity[]; total: number; hasMore: boolean }> {
    const [activities, total] = await Promise.all([
      (this.prisma as any).teamActivity.findMany({
        where: { companyId, userId },
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).teamActivity.count({
        where: { companyId, userId },
      }),
    ]);

    return {
      activities,
      total,
      hasMore: page * limit < total,
    };
  }

  async getContributions(
    companyId: string,
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    total: number;
    breakdown: Record<string, number>;
    heatmap: ContributionHeatmap;
  }> {
    const activities = await (this.prisma as any).teamActivity.findMany({
      where: {
        companyId,
        userId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const breakdown: Record<string, number> = {};
    const heatmap: ContributionHeatmap = { weeks: [] };

    activities.forEach((activity: any) => {
      breakdown[activity.activityType] =
        (breakdown[activity.activityType] || 0) + 1;
    });

    // Generate heatmap data
    heatmap.weeks = this.generateHeatmapData(activities, startDate, endDate);

    return {
      total: activities.length,
      breakdown,
      heatmap,
    };
  }

  async getCollaborationPatterns(
    companyId: string,
    userId: string,
  ): Promise<{
    interactionPartners: Array<{ userId: string; count: number }>;
    activeHours: number[];
    activeDays: number[];
    responsePatterns: ResponsePatterns;
  }> {
    const activities = await (this.prisma as any).teamActivity.findMany({
      where: { companyId, userId },
      orderBy: { timestamp: 'desc' },
      take: 200,
    });

    // Analyze patterns
    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const partnerCounts = new Map<string, number>();

    activities.forEach((activity: any) => {
      const date = new Date(activity.timestamp);
      hourCounts[date.getHours()]++;
      dayCounts[date.getDay()]++;
    });

    // Find most active hours and days
    const activeHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((h) => h.hour);

    const activeDays = dayCounts
      .map((count, day) => ({ day, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((d) => d.day);

    return {
      interactionPartners: Array.from(partnerCounts.entries()).map(
        ([userId, count]) => ({ userId, count }),
      ),
      activeHours,
      activeDays,
      responsePatterns: {
        avgResponseTime: 0, // Would need mention tracking
        responseRate: 0,
      },
    };
  }

  private async getActivityStats(
    companyId: string,
    userId: string,
  ): Promise<ActivityStats> {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allActivities, weekActivities, monthActivities] = await Promise.all([
      (this.prisma as any).teamActivity.findMany({
        where: { companyId, userId },
      }),
      (this.prisma as any).teamActivity.findMany({
        where: {
          companyId,
          userId,
          timestamp: { gte: startOfWeek },
        },
      }),
      (this.prisma as any).teamActivity.findMany({
        where: {
          companyId,
          userId,
          timestamp: { gte: startOfMonth },
        },
      }),
    ]);

    const uniqueDays = new Set(
      allActivities.map((a: any) => new Date(a.timestamp).toDateString()),
    ).size;

    const activityTypeCount: Record<string, number> = {};
    allActivities.forEach((a: any) => {
      activityTypeCount[a.activityType] =
        (activityTypeCount[a.activityType] || 0) + 1;
    });

    const topActivityTypes = Object.entries(activityTypeCount)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalActions: allActivities.length,
      actionsThisWeek: weekActivities.length,
      actionsThisMonth: monthActivities.length,
      uniqueDaysActive: uniqueDays,
      averageActionsPerDay:
        uniqueDays > 0
          ? Math.round((allActivities.length / uniqueDays) * 100) / 100
          : 0,
      topActivityTypes,
    };
  }

  private identifyExpertiseAreas(
    companyId: string,
    userId: string,
    topActivityTypes: Array<{ type: string; count: number }>,
  ): string[] {
    const expertiseMap: Record<string, string[]> = {
      RETIREMENT_CREATED: ['Carbon Retirement', 'Climate Action'],
      REPORT_GENERATED: ['Reporting', 'Analytics'],
      COMPLIANCE_COMPLETED: ['Compliance', 'Regulatory'],
      AUCTION_BID_PLACED: ['Trading', 'Market Operations'],
      TEAM_MEMBER_ADDED: ['Team Management', 'HR'],
      ROLE_CHANGED: ['Team Management'],
      DOCUMENT_UPLOADED: ['Documentation', 'Knowledge Management'],
    };

    const areas = new Set<string>();

    topActivityTypes.forEach(({ type }) => {
      const area = expertiseMap[type];
      if (area) {
        area.forEach((a) => areas.add(a));
      }
    });

    return Array.from(areas);
  }

  private generateHeatmapData(
    activities: any[],
    startDate: Date,
    endDate: Date,
  ): Array<{ weekStart: Date; contributions: number }> {
    const weeks: Array<{ weekStart: Date; contributions: number }> = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const count = activities.filter((a) => {
        const date = new Date(a.timestamp);
        return date >= weekStart && date < weekEnd;
      }).length;

      weeks.push({ weekStart, contributions: count });
      current.setDate(current.getDate() + 7);
    }

    return weeks;
  }
}

export interface ContributionHeatmap {
  weeks: Array<{ weekStart: Date; contributions: number }>;
}

export interface ResponsePatterns {
  avgResponseTime: number;
  responseRate: number;
}
