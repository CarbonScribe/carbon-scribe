import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  CollaborationScore,
  CollaborationScoreQuery,
  ScoreComponents,
  CollaborationRating,
  Recommendation,
  ScoreHistory,
  TopContributor,
} from '../interfaces/collaboration-score.interface';

@Injectable()
export class CollaborationScoreService {
  private readonly logger = new Logger(CollaborationScoreService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getCollaborationScore(
    query: CollaborationScoreQuery,
  ): Promise<CollaborationScore> {
    const {
      companyId,
      periodStart: queryStart,
      periodEnd: queryEnd,
      metricType = 'WEEKLY_SCORE',
      includeHistory = true,
      includeRecommendations = true,
    } = query;

    // Default to last 7 days if not specified
    const periodEnd = queryEnd || new Date();
    const periodStart =
      queryStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const components = await this.calculateScoreComponents(
      companyId,
      periodStart,
      periodEnd,
    );

    const overallScore = this.calculateOverallScore(components);
    const rating = this.getRating(overallScore);
    const insights = this.generateInsights(components, overallScore);
    const recommendations = includeRecommendations
      ? this.generateRecommendations(components, overallScore)
      : [];
    const history = includeHistory
      ? await this.getScoreHistory(companyId, metricType)
      : [];

    // Save metric to database
    await this.saveCollaborationMetric({
      companyId,
      periodStart,
      periodEnd,
      metricType,
      overallScore,
      components,
      insights,
    });

    return {
      companyId,
      periodStart,
      periodEnd,
      overallScore,
      components,
      rating,
      insights,
      recommendations,
      history,
    };
  }

  async getTopContributors(
    companyId: string,
    limit = 10,
  ): Promise<TopContributor[]> {
    const members = await (this.prisma as any).teamMember.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { user: true },
    });

    const contributors: TopContributor[] = [];

    for (const member of members.slice(0, limit)) {
      const activities = await (this.prisma as any).teamActivity.findMany({
        where: {
          companyId,
          userId: member.userId,
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      const contributions = this.calculateContributions(activities);
      const collaborationScore =
        this.calculateMemberCollaborationScore(contributions);

      contributors.push({
        userId: member.userId,
        email: member.user.email,
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        collaborationScore,
        contributions,
      });
    }

    return contributors.sort(
      (a, b) => b.collaborationScore - a.collaborationScore,
    );
  }

  private async calculateScoreComponents(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ScoreComponents> {
    const activities = await (this.prisma as any).teamActivity.findMany({
      where: {
        companyId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const members = await (this.prisma as any).teamMember.count({
      where: { companyId, status: 'ACTIVE' },
    });

    return {
      communicationScore: this.calculateCommunicationScore(activities, members),
      knowledgeSharingScore: this.calculateKnowledgeSharingScore(
        activities,
        members,
      ),
      responseTimeScore: 75, // Would need actual response time data
      meetingParticipationScore: 70, // Would need meeting integration
      crossTeamCollaborationScore: this.calculateCrossTeamScore(
        activities,
        members,
      ),
      goalAlignmentScore: await this.calculateGoalAlignmentScore(
        companyId,
        startDate,
        endDate,
      ),
    };
  }

  private calculateCommunicationScore(
    activities: any[],
    members: number,
  ): number {
    const communicationTypes = [
      'TEAM_MEMBER_ADDED',
      'ROLE_CHANGED',
      'SETTINGS_UPDATED',
    ];

    const communicationCount = activities.filter((a) =>
      communicationTypes.includes(a.activityType),
    ).length;

    const perMemberAvg = members > 0 ? communicationCount / members : 0;
    return Math.min(Math.round(perMemberAvg * 10) * 10, 100);
  }

  private calculateKnowledgeSharingScore(
    activities: any[],
    members: number,
  ): number {
    const knowledgeTypes = [
      'REPORT_GENERATED',
      'DOCUMENT_UPLOADED',
      'COMPLIANCE_COMPLETED',
    ];

    const knowledgeCount = activities.filter((a) =>
      knowledgeTypes.includes(a.activityType),
    ).length;

    const perMemberAvg = members > 0 ? knowledgeCount / members : 0;
    return Math.min(Math.round(perMemberAvg * 15) * 10, 100);
  }

  private calculateCrossTeamScore(activities: any[], members: number): number {
    // Check for diverse activity types indicating cross-functional work
    const uniqueTypes = new Set(activities.map((a) => a.activityType)).size;
    const diversityRatio = uniqueTypes / 16; // Total possible activity types

    const participationRate =
      members > 0 ? new Set(activities.map((a) => a.userId)).size / members : 0;

    return (
      Math.round((diversityRatio * 50 + participationRate * 50) * 100) / 100
    );
  }

  private async calculateGoalAlignmentScore(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const retirements = await (this.prisma as any).retirement.count({
      where: {
        companyId,
        retiredAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const targets = await (this.prisma as any).retirementTarget.findMany({
      where: { companyId },
    });

    const targetTotal = targets.reduce(
      (sum: number, t: any) => sum + t.target,
      0,
    );

    if (targetTotal === 0) return 50; // Neutral score if no targets

    const achievementRatio = retirements / targetTotal;
    return Math.min(Math.round(achievementRatio * 100) * 100, 100);
  }

  private calculateOverallScore(components: ScoreComponents): number {
    const weights = {
      communicationScore: 0.2,
      knowledgeSharingScore: 0.2,
      responseTimeScore: 0.15,
      meetingParticipationScore: 0.15,
      crossTeamCollaborationScore: 0.15,
      goalAlignmentScore: 0.15,
    };

    const score =
      components.communicationScore * weights.communicationScore +
      components.knowledgeSharingScore * weights.knowledgeSharingScore +
      components.responseTimeScore * weights.responseTimeScore +
      components.meetingParticipationScore * weights.meetingParticipationScore +
      components.crossTeamCollaborationScore *
        weights.crossTeamCollaborationScore +
      components.goalAlignmentScore * weights.goalAlignmentScore;

    return Math.round(score * 100) / 100;
  }

  private getRating(overallScore: number): CollaborationRating {
    if (overallScore >= 90) return 'EXCELLENT';
    if (overallScore >= 75) return 'VERY_GOOD';
    if (overallScore >= 60) return 'GOOD';
    if (overallScore >= 40) return 'FAIR';
    return 'NEEDS_IMPROVEMENT';
  }

  private generateInsights(
    components: ScoreComponents,
    overallScore: number,
  ): string[] {
    const insights: string[] = [];

    if (components.communicationScore >= 80) {
      insights.push('Strong team communication and engagement');
    } else if (components.communicationScore < 50) {
      insights.push('Team communication needs improvement');
    }

    if (components.knowledgeSharingScore >= 80) {
      insights.push('Excellent knowledge sharing culture');
    } else if (components.knowledgeSharingScore < 50) {
      insights.push('Consider encouraging more documentation and reporting');
    }

    if (components.goalAlignmentScore >= 80) {
      insights.push('Team is on track to meet sustainability goals');
    }

    if (overallScore >= 75) {
      insights.push('High-performing collaborative team');
    } else if (overallScore < 50) {
      insights.push('Opportunities exist to improve team collaboration');
    }

    return insights;
  }

  private generateRecommendations(
    components: ScoreComponents,
    overallScore: number,
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (components.communicationScore < 60) {
      recommendations.push({
        category: 'Communication',
        priority: 'HIGH',
        description: 'Implement regular team check-ins and updates',
        expectedImpact: 'Improve communication score by 15-20 points',
        implementationEffort: 'LOW',
      });
    }

    if (components.knowledgeSharingScore < 60) {
      recommendations.push({
        category: 'Knowledge Sharing',
        priority: 'MEDIUM',
        description:
          'Create documentation templates and encourage report generation',
        expectedImpact: 'Increase knowledge sharing by 25%',
        implementationEffort: 'MEDIUM',
      });
    }

    if (components.crossTeamCollaborationScore < 60) {
      recommendations.push({
        category: 'Cross-Team Collaboration',
        priority: 'MEDIUM',
        description: 'Organize cross-functional projects and initiatives',
        expectedImpact: 'Enhance collaboration across departments',
        implementationEffort: 'HIGH',
      });
    }

    if (overallScore < 50) {
      recommendations.push({
        category: 'Overall Engagement',
        priority: 'HIGH',
        description: 'Launch team engagement program with clear goals',
        expectedImpact: 'Boost overall collaboration score by 30+ points',
        implementationEffort: 'HIGH',
      });
    }

    return recommendations;
  }

  private async getScoreHistory(
    companyId: string,
    metricType: 'WEEKLY_SCORE' | 'MONTHLY_SCORE',
  ): Promise<ScoreHistory[]> {
    const metrics = await (this.prisma as any).collaborationMetric.findMany({
      where: {
        companyId,
        metricType,
      },
      orderBy: { periodStart: 'desc' },
      take: 12,
    });

    return metrics.map((m: any) => ({
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
      overallScore: m.overallScore,
      metricType: m.metricType,
    }));
  }

  private calculateContributions(activities: any[]) {
    return {
      communications: activities.filter((a) =>
        ['TEAM_MEMBER_ADDED', 'ROLE_CHANGED'].includes(a.activityType),
      ).length,
      knowledgeSharing: activities.filter((a) =>
        [
          'REPORT_GENERATED',
          'DOCUMENT_UPLOADED',
          'COMPLIANCE_COMPLETED',
        ].includes(a.activityType),
      ).length,
      helpProvided: 0, // Would need mention/response tracking
      meetingsAttended: 0, // Would need meeting integration
      goalsCompleted: activities.filter((a) =>
        ['RETIREMENT_CREATED', 'TARGET_SET', 'COMPLIANCE_COMPLETED'].includes(
          a.activityType,
        ),
      ).length,
    };
  }

  private calculateMemberCollaborationScore(contributions: any): number {
    const weights = {
      communications: 0.2,
      knowledgeSharing: 0.25,
      helpProvided: 0.2,
      meetingsAttended: 0.15,
      goalsCompleted: 0.2,
    };

    const total = (Object.values(contributions) as number[]).reduce(
      (a, b) => a + b,
      0,
    );

    if (total === 0) return 0;

    const normalized = {
      communications: contributions.communications / (total || 1),
      knowledgeSharing: contributions.knowledgeSharing / (total || 1),
      helpProvided: contributions.helpProvided / (total || 1),
      meetingsAttended: contributions.meetingsAttended / (total || 1),
      goalsCompleted: contributions.goalsCompleted / (total || 1),
    };

    const score =
      normalized.communications * weights.communications * 100 +
      normalized.knowledgeSharing * weights.knowledgeSharing * 100 +
      normalized.helpProvided * weights.helpProvided * 100 +
      normalized.meetingsAttended * weights.meetingsAttended * 100 +
      normalized.goalsCompleted * weights.goalsCompleted * 100;

    return Math.round(score * 100) / 100;
  }

  private async saveCollaborationMetric(data: {
    companyId: string;
    periodStart: Date;
    periodEnd: Date;
    metricType: string;
    overallScore: number;
    components: ScoreComponents;
    insights: string[];
  }): Promise<void> {
    try {
      const topContributors = await this.getTopContributors(data.companyId, 5);

      await (this.prisma as any).collaborationMetric.upsert({
        where: {
          id_periodStart: {
            id: `${data.companyId}_${data.periodStart.toISOString()}`,
            periodStart: data.periodStart,
          },
        },
        update: {
          overallScore: data.overallScore,
          components: data.components as any,
          topContributors: topContributors as any,
          insights: data.insights,
        },
        create: {
          companyId: data.companyId,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          metricType: data.metricType,
          overallScore: data.overallScore,
          components: data.components as any,
          topContributors: topContributors as any,
          insights: data.insights,
        },
      });
    } catch (error) {
      this.logger.error('Error saving collaboration metric:', error);
    }
  }
}
