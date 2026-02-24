import { Injectable } from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityEventInput } from './interfaces/security-event.interface';
import {
  EventSeverityMap,
  SecurityEvents,
  SecuritySeverity,
} from './constants/security-events.constants';

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

    const prisma = this.prisma as any;

    const entries = await prisma.ipWhitelist.findMany({
      where: { companyId, isActive: true },
    });

    if (!entries.length) {
      return true;
    }

    const normalizedIp = this.normalizeIp(ipAddress);

    return entries.some((entry: { cidr: string }) =>
      this.isIpInCidr(normalizedIp, entry.cidr),
    );
  }

  async listWhitelist(companyId: string) {
    const prisma = this.prisma as any;

    return prisma.ipWhitelist.findMany({
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

    const prisma = this.prisma as any;

    return prisma.ipWhitelist.create({
      data: {
        companyId,
        cidr,
        description,
        createdBy: userId,
      },
    });
  }

  async removeWhitelist(id: string, companyId: string, userId: string) {
    const prisma = this.prisma as any;

    await prisma.ipWhitelist.delete({
      where: { id },
    });

    await this.logEvent({
      eventType: SecurityEvents.IpBlocked,
      companyId,
      userId,
      status: 'removed-whitelist',
    });
  }

  async logEvent(event: SecurityEventInput): Promise<void> {
    const timestamp = event.timestamp ?? new Date();

    const prisma = this.prisma as any;

    await prisma.auditLog.create({
      data: {
        companyId: event.companyId,
        userId: event.userId,
        eventType: event.eventType,
        severity:
          event.severity ||
          EventSeverityMap[event.eventType] ||
          ('info' as SecuritySeverity),
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        resource: event.resource,
        method: event.method,
        status: event.status ?? 'ok',
        statusCode: event.statusCode,
        details: event.metadata ?? undefined,
        oldValue: undefined,
        newValue: undefined,
        timestamp,
      },
    });

    this.triggerAlert(event);
  }

  async queryAuditLogs(companyId: string, limit = 100) {
    const prisma = this.prisma as any;

    return prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
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

    const prisma = this.prisma as any;

    await prisma.auditLog.deleteMany({
      where: { timestamp: { lt: cutoff } },
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
          ('info' as SecuritySeverity),
        companyId: event.companyId,
        userId: event.userId,
        status: event.status,
        statusCode: event.statusCode,
        timestamp: (event.timestamp || new Date()).toISOString(),
        metadata: event.metadata,
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
        (res) => {
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
      return ip.substring(lastIndex + 1);
    }

    return ip;
  }

  private isIpInCidr(ip: string, cidr: string) {
    const [cidrIp, prefixStr] = cidr.split('/');
    const prefix = Number(prefixStr);
    const ipParts = ip.split('.').map((x) => Number(x));
    const cidrParts = cidrIp.split('.').map((x) => Number(x));

    if (ipParts.length !== 4 || cidrParts.length !== 4) {
      return false;
    }

    const mask = ~((1 << (32 - prefix)) - 1);

    const ipNum =
      (ipParts[0] << 24) |
      (ipParts[1] << 16) |
      (ipParts[2] << 8) |
      ipParts[3];

    const cidrNum =
      (cidrParts[0] << 24) |
      (cidrParts[1] << 16) |
      (cidrParts[2] << 8) |
      cidrParts[3];

    return (ipNum & mask) === (cidrNum & mask);
  }
}

