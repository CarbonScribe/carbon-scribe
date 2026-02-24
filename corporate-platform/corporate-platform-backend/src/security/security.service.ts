import { Injectable } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { PrismaService } from '../shared/database/prisma.service';
import {
  EventSeverityMap,
  SecurityEvents,
  SecuritySeverity,
} from './constants/security-events.constants';
import { SecurityEventInput } from './interfaces/security-event.interface';

@Injectable()
export class SecurityService {
  private readonly retentionDays =
    Number(process.env.SECURITY_LOG_RETENTION_DAYS || '90') || 90;

  private readonly failedLoginCounts = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async isIpAllowed(
    companyId: string | null,
    ipAddress: string,
  ): Promise<boolean> {
    const overrideToken = process.env.ADMIN_SECURITY_OVERRIDE_TOKEN;
    if (overrideToken && ipAddress === overrideToken) {
      return true;
    }

    if (!companyId) {
      return true;
    }

    const entries = await this.prisma.ipWhitelist.findMany({
      where: {
        companyId,
        isActive: true,
      },
    });

    if (!entries.length) {
      return true;
    }

    const normalizedIp = this.normalizeIp(ipAddress);

    return entries.some((entry) => this.isIpInCidr(normalizedIp, entry.cidr));
  }

  async listWhitelist(companyId: string) {
    return this.prisma.ipWhitelist.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addWhitelist(
    companyId: string,
    userId: string,
    cidr: string,
    description?: string,
  ) {
    this.ensureValidCidr(cidr);

    const entry = await this.prisma.ipWhitelist.create({
      data: {
        companyId,
        cidr,
        description,
        createdBy: userId,
      },
    });

    await this.logEvent({
      eventType: SecurityEvents.IpWhitelistAdded,
      companyId,
      userId,
      details: { cidr, description },
      status: 'success',
    });

    return entry;
  }

  async removeWhitelist(id: string, companyId: string, userId: string) {
    const existing = await this.prisma.ipWhitelist.findUnique({
      where: { id },
    });

    if (!existing || existing.companyId !== companyId) {
      return { success: false };
    }

    await this.prisma.ipWhitelist.delete({
      where: { id },
    });

    await this.logEvent({
      eventType: SecurityEvents.IpWhitelistRemoved,
      companyId,
      userId,
      details: { cidr: existing.cidr },
      status: 'success',
    });

    return { success: true };
  }

  // Backwards-compatible wrappers for older naming used in tests/controllers
  async addWhitelistEntry(
    companyId: string,
    cidr: string,
    userId: string,
    description?: string,
  ) {
    return this.addWhitelist(companyId, userId, cidr, description);
  }

  async removeWhitelistEntry(companyId: string, id: string, userId: string) {
    return this.removeWhitelist(id, companyId, userId);
  }

  async logEvent(input: SecurityEventInput) {
    const severity =
      input.severity ||
      EventSeverityMap[input.eventType] ||
      SecuritySeverity.Info;

    const timestamp = input.timestamp || new Date();

    await this.prisma.auditLog.create({
      data: {
        companyId: input.companyId ?? null,
        userId: input.userId ?? null,
        eventType: input.eventType,
        severity,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        resource: input.resource ?? null,
        method: input.method ?? null,
        details: input.details ?? undefined,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        status: input.status,
        statusCode: input.statusCode ?? null,
        timestamp,
      },
    });

    if (severity === SecuritySeverity.Critical) {
      this.triggerAlert(input);
    }

    await this.enforceRetention();
  }

  async queryAuditLogs(options: {
    companyId?: string;
    userId?: string;
    eventType?: string;
    severity?: string;
    status?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit =
      options.limit && options.limit > 0 && options.limit <= 100
        ? options.limit
        : 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (options.companyId) where.companyId = options.companyId;
    if (options.userId) where.userId = options.userId;
    if (options.eventType) where.eventType = options.eventType;
    if (options.severity) where.severity = options.severity;
    if (options.status) where.status = options.status;
    if (options.from || options.to) {
      where.timestamp = {};
      if (options.from) where.timestamp.gte = options.from;
      if (options.to) where.timestamp.lte = options.to;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async getSummary(companyId: string) {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [totalEvents, criticalEvents, recentFailedLogins] = await Promise.all(
      [
        this.prisma.auditLog.count({
          where: { companyId },
        }),
        this.prisma.auditLog.count({
          where: {
            companyId,
            severity: SecuritySeverity.Critical,
            timestamp: { gte: oneDayAgo },
          },
        }),
        this.prisma.auditLog.count({
          where: {
            companyId,
            eventType: SecurityEvents.AuthLoginFailed,
            timestamp: { gte: oneDayAgo },
          },
        }),
      ],
    );

    return {
      totalEvents,
      criticalEventsLast24h: criticalEvents,
      failedLoginsLast24h: recentFailedLogins,
    };
  }

  registerFailedLogin(key: string) {
    const count = (this.failedLoginCounts.get(key) ?? 0) + 1;
    this.failedLoginCounts.set(key, count);
    return count;
  }

  clearFailedLogins(key: string) {
    this.failedLoginCounts.delete(key);
  }

  private async enforceRetention() {
    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoff,
        },
      },
    });
  }

  private triggerAlert(event: SecurityEventInput) {
    const webhookUrl = process.env.SECURITY_ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      return;
    }

    try {
      const url = new URL(webhookUrl);
      const payload = JSON.stringify({
        eventType: event.eventType,
        severity:
          event.severity ||
          EventSeverityMap[event.eventType] ||
          SecuritySeverity.Info,
        companyId: event.companyId,
        userId: event.userId,
        status: event.status,
        statusCode: event.statusCode,
        timestamp: (event.timestamp || new Date()).toISOString(),
      });

      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const request = client.request(
        {
          method: 'POST',
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res: any) => {
          res.on('data', () => undefined);
        },
      );

      request.on('error', () => undefined);
      request.write(payload);
      request.end();
    } catch {
      return;
    }
  }

  private ensureValidCidr(cidr: string) {
    const parts = cidr.split('/');
    if (parts.length !== 2) {
      throw new Error('Invalid CIDR');
    }
    const [ip, prefix] = parts;
    const prefixNum = Number(prefix);
    if (
      !this.isValidIpv4(ip) ||
      !Number.isInteger(prefixNum) ||
      prefixNum < 0 ||
      prefixNum > 32
    ) {
      throw new Error('Invalid CIDR');
    }
  }

  private isValidIpv4(ip: string) {
    const normalized = this.normalizeIp(ip);
    const segments = normalized.split('.');
    if (segments.length !== 4) {
      return false;
    }
    return segments.every((seg) => {
      if (!/^\d+$/.test(seg)) return false;
      const n = Number(seg);
      return n >= 0 && n <= 255;
    });
  }

  private normalizeIp(ip: string) {
    if (ip.includes(':') && ip.includes('.')) {
      const lastIndex = ip.lastIndexOf(':');
      return ip.slice(lastIndex + 1);
    }
    if (ip === '::1') {
      return '127.0.0.1';
    }
    return ip;
  }

  private isIpInCidr(ip: string, cidr: string) {
    const [network, prefix] = cidr.split('/');
    const ipNum = this.ipToNumber(this.normalizeIp(ip));
    const networkNum = this.ipToNumber(this.normalizeIp(network));
    const mask = prefix === '0' ? 0 : ~((1 << (32 - Number(prefix))) - 1);
    return (ipNum & mask) === (networkNum & mask);
  }

  private ipToNumber(ip: string) {
    const segments = this.normalizeIp(ip)
      .split('.')
      .map((n) => Number(n));
    return (
      ((segments[0] << 24) |
        (segments[1] << 16) |
        (segments[2] << 8) |
        segments[3]) >>>
      0
    );
  }
}
