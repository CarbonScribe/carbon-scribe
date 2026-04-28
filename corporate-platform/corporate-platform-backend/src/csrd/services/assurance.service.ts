import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditTrailService } from '../../audit-trail/audit-trail.service';
import {
  AuditAction,
  AuditEventType,
} from '../../audit-trail/interfaces/audit-event.interface';

@Injectable()
export class AssuranceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditTrailService: AuditTrailService,
  ) {}

  async updateAssurance(
    companyId: string,
    disclosureId: string,
    assuranceLevel: 'LIMITED' | 'REASONABLE',
    assuredBy: string,
    userId = 'system',
  ) {
    const previous = await this.prisma.esrsDisclosure.findFirst({
      where: { id: disclosureId, companyId },
    });

    if (!previous) {
      throw new NotFoundException(
        `Disclosure ${disclosureId} not found for company ${companyId}`,
      );
    }

    const updated = await this.prisma.esrsDisclosure.update({
      where: { id: disclosureId },
      data: { assuranceLevel, assuredBy, assuredAt: new Date() },
    });

    await this.auditTrailService.createAuditEvent(companyId, userId, {
      eventType: AuditEventType.CSRD_DISCLOSURE,
      action: AuditAction.APPROVE,
      entityType: 'EsrsDisclosure',
      entityId: disclosureId,
      previousState: previous,
      newState: updated,
      metadata: { assuranceLevel, assuredBy },
    });

    return updated;
  }
}
