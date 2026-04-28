import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class RetentionManagerService {
  private readonly retentionDays =
    Number(process.env.AUDIT_TRAIL_RETENTION_DAYS || '3650') || 3650;

  constructor(private readonly prisma: PrismaService) {}

  async enforceRetention(companyId?: string) {
    if (this.retentionDays <= 0) {
      return { deletedCount: 0 };
    }

    const cutoff = new Date(
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000,
    );

    const result = await this.prisma.auditEvent.deleteMany({
      where: {
        ...(companyId ? { companyId } : {}),
        timestamp: {
          lt: cutoff,
        },
      },
    });

    return { deletedCount: result.count };
  }
}
