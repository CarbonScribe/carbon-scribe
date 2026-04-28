import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { RedisService } from '../../cache/redis.service';

export interface TeamNotification {
  id: string;
  companyId: string;
  userId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
}

export type NotificationType =
  | 'TEAM_MEMBER_JOINED'
  | 'ROLE_CHANGED'
  | 'TARGET_ACHIEVED'
  | 'COLLABORATION_MILESTONE'
  | 'ACTIVITY_ALERT'
  | 'REPORT_PUBLISHED'
  | 'COMPLIANCE_DUE'
  | 'SCORE_UPDATE';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async sendTeamNotification(notification: {
    companyId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
  }): Promise<TeamNotification> {
    const teamNotification: TeamNotification = {
      id: this.generateId(),
      companyId: notification.companyId,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read: false,
      createdAt: new Date(),
    };

    // Store in Redis for real-time delivery
    await this.storeNotification(teamNotification);

    // Emit via Redis pub/sub
    await this.emitNotification(teamNotification);

    return teamNotification;
  }

  async getUnreadNotifications(
    companyId: string,
    userId?: string,
  ): Promise<TeamNotification[]> {
    const key = userId
      ? `notifications:${companyId}:${userId}:unread`
      : `notifications:${companyId}:unread`;

    const data = await this.redis.getClient().get(key);
    return data ? JSON.parse(data) : [];
  }

  async markAsRead(
    notificationId: string,
    companyId: string,
    userId: string,
  ): Promise<void> {
    const key = `notifications:${companyId}:${userId}:unread`;
    const notifications = await this.getUnreadNotifications(companyId, userId);

    const updated = notifications.filter((n) => n.id !== notificationId);
    await this.redis.getClient().set(key, JSON.stringify(updated));

    // Add to read notifications
    const readKey = `notifications:${companyId}:${userId}:read`;
    const readNotifications = await this.redis.getClient().get(readKey);
    const readList = readNotifications ? JSON.parse(readNotifications) : [];

    const notification = notifications.find((n) => n.id === notificationId);
    if (notification) {
      readList.push({ ...notification, read: true });
      await this.redis
        .getClient()
        .set(readKey, JSON.stringify(readList.slice(-50))); // Keep last 50
    }
  }

  async notifyTeamMemberJoined(
    companyId: string,
    memberEmail: string,
    memberName: string,
  ): Promise<void> {
    await this.sendTeamNotification({
      companyId,
      type: 'TEAM_MEMBER_JOINED',
      title: 'New Team Member',
      message: `${memberName} has joined the team!`,
      data: { email: memberEmail, name: memberName },
    });
  }

  async notifyRoleChange(
    companyId: string,
    userId: string,
    oldRole: string,
    newRole: string,
  ): Promise<void> {
    await this.sendTeamNotification({
      companyId,
      userId,
      type: 'ROLE_CHANGED',
      title: 'Role Updated',
      message: `Your role has been changed from ${oldRole} to ${newRole}`,
      data: { oldRole, newRole },
    });
  }

  async notifyTargetAchieved(
    companyId: string,
    target: number,
    actual: number,
  ): Promise<void> {
    await this.sendTeamNotification({
      companyId,
      type: 'TARGET_ACHIEVED',
      title: 'Retirement Target Achieved!',
      message: `Congratulations! The team has retired ${actual} credits, exceeding the target of ${target}`,
      data: { target, actual },
    });
  }

  async notifyCollaborationMilestone(
    companyId: string,
    score: number,
    rating: string,
  ): Promise<void> {
    await this.sendTeamNotification({
      companyId,
      type: 'COLLABORATION_MILESTONE',
      title: 'Collaboration Milestone',
      message: `Team collaboration score reached ${score} (${rating})!`,
      data: { score, rating },
    });
  }

  private async storeNotification(
    notification: TeamNotification,
  ): Promise<void> {
    try {
      const key = notification.userId
        ? `notifications:${notification.companyId}:${notification.userId}:unread`
        : `notifications:${notification.companyId}:all:unread`;

      const existing = await this.redis.getClient().get(key);
      const list = existing ? JSON.parse(existing) : [];

      list.push(notification);
      await this.redis.getClient().set(key, JSON.stringify(list.slice(-100))); // Keep last 100
    } catch (error) {
      this.logger.error('Error storing notification:', error);
    }
  }

  private async emitNotification(
    notification: TeamNotification,
  ): Promise<void> {
    try {
      await this.redis.getClient().publish(
        'notifications:stream',
        JSON.stringify({
          event: 'notification:created',
          companyId: notification.companyId,
          userId: notification.userId,
          data: notification,
        }),
      );
    } catch (error) {
      this.logger.error('Error emitting notification:', error);
    }
  }

  private generateId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
