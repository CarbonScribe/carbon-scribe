import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../rbac/guards/roles.guard';
import { Roles } from '../rbac/decorators/roles.decorator';
import { CertificateDeadLetterService } from './services/certificate-dead-letter.service';
import { CertificateRetrySchedulerService } from './services/certificate-retry-scheduler.service';
import { CertificateFailureQueryDto } from './dto/certificate-failure-query.dto';

/**
 * CertificateFailureController (#400)
 *
 * Admin endpoints for the certificate anchoring dead-letter / recovery
 * workflow. They let operators inspect failed anchors, force an immediate
 * retry, or manually mark a record resolved — recovering certificate failures
 * without database forensics.
 *
 * Base path: /api/v1/ipfs/certificate-failures
 * Access control: authenticated admins only.
 */
@Controller('api/v1/ipfs/certificate-failures')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class CertificateFailureController {
  constructor(
    private readonly deadLetter: CertificateDeadLetterService,
    private readonly scheduler: CertificateRetrySchedulerService,
  ) {}

  /** GET / — list failures with optional filtering/pagination. */
  @Get()
  async list(@Query() query: CertificateFailureQueryDto) {
    return this.deadLetter.listFailures({
      status: query.status,
      companyId: query.companyId,
      retirementId: query.retirementId,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /** GET /:id — fetch a single failure record with full recovery context. */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.deadLetter.getFailure(id);
  }

  /**
   * POST /:id/retry — force an immediate reprocessing attempt. Requeues the
   * record and runs the anchor synchronously so the caller sees the outcome.
   */
  @Post(':id/retry')
  async retry(@Param('id') id: string) {
    await this.deadLetter.requeue(id);
    const outcome = await this.scheduler.processOne(id);
    const record = await this.deadLetter.getFailure(id);
    return { outcome, record };
  }

  /**
   * POST /:id/resolve — mark a failure resolved without retrying (e.g. it was
   * repaired out of band or is no longer relevant).
   */
  @Post(':id/resolve')
  async resolve(@Param('id') id: string) {
    await this.deadLetter.getFailure(id);
    return this.deadLetter.markResolved(id);
  }
}
