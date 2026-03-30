import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../shared/database/prisma.service';
import { SecurityService } from '../security/security.service';
import { TargetValidationService } from './services/target-validation.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { SubmissionService } from './services/submission.service';
import { CreateTargetDto } from './dto/create-target.dto';
import { ProgressQueryDto } from './dto/progress-query.dto';
import {
  IDashboardMetrics,
  IDashboardTargetSummary,
  IRetirementGapResult,
  ITargetGap,
} from './interfaces/progress-metrics.interface';
import { ISbtiTarget } from './interfaces/sbti-target.interface';

@Injectable()
export class SbtiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly securityService: SecurityService,
    private readonly validationService: TargetValidationService,
    private readonly progressTrackingService: ProgressTrackingService,
    private readonly submissionService: SubmissionService,
  ) {}

  async createTarget(companyId: string, dto: CreateTargetDto) {
    this.assertCompanyId(companyId);

    const validation = this.validationService.validate(dto);

    const target = await this.prisma.sbtiTarget.create({
      data: {
        companyId,
        targetType: dto.targetType,
        scope: dto.scope,
        baseYear: dto.baseYear,
        baseYearEmissions: dto.baseYearEmissions,
        targetYear: dto.targetYear,
        reductionPercentage: dto.reductionPercentage,
        status: 'DRAFT',
      },
    });

    await this.securityService.logEvent({
      eventType: 'sbti.target.created' as any,
      companyId,
      details: {
        targetId: target.id,
        targetType: target.targetType,
        scope: target.scope,
        validationPassed: validation.isValid,
      },
      status: 'success',
    });

    return { target, validation };
  }

  async listTargets(companyId: string) {
    this.assertCompanyId(companyId);

    return this.prisma.sbtiTarget.findMany({
      where: { companyId },
      include: { progress: { orderBy: { reportingYear: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTargetProgress(
    companyId: string,
    targetId: string,
    query: ProgressQueryDto,
  ) {
    this.assertCompanyId(companyId);

    const target = await this.prisma.sbtiTarget.findFirst({
      where: { id: targetId, companyId },
      include: { progress: { orderBy: { reportingYear: 'asc' } } },
    });

    if (!target) {
      throw new NotFoundException(`SBTi target ${targetId} not found`);
    }

    const records = query.year
      ? target.progress.filter((p) => p.reportingYear === query.year)
      : target.progress;

    const metrics = this.progressTrackingService.buildProgressMetrics({
      targetId: target.id,
      targetType: target.targetType,
      scope: target.scope,
      baseYear: target.baseYear,
      baseYearEmissions: target.baseYearEmissions,
      targetYear: target.targetYear,
      reductionPercentage: target.reductionPercentage,
      progressRecords: records.map((p) => ({
        reportingYear: p.reportingYear,
        emissions: p.emissions,
      })),
    });

    return { target, progressRecords: records, metrics };
  }

  async validateTarget(companyId: string, targetId: string) {
    this.assertCompanyId(companyId);

    const target = await this.prisma.sbtiTarget.findFirst({
      where: { id: targetId, companyId },
    });

    if (!target) {
      throw new NotFoundException(`SBTi target ${targetId} not found`);
    }

    const validation = this.validationService.validate({
      targetType: target.targetType as any,
      scope: target.scope as any,
      baseYear: target.baseYear,
      baseYearEmissions: target.baseYearEmissions,
      targetYear: target.targetYear,
      reductionPercentage: target.reductionPercentage,
    });

    const newStatus = validation.isValid ? 'VALIDATED' : 'DRAFT';
    const validationId = validation.isValid
      ? `VAL-${targetId.slice(-6).toUpperCase()}-${Date.now()}`
      : null;

    const updated = await this.prisma.sbtiTarget.update({
      where: { id: targetId },
      data: {
        status: newStatus,
        validationId,
        validatedAt: validation.isValid ? new Date() : null,
      },
    });

    await this.securityService.logEvent({
      eventType: 'sbti.target.validated' as any,
      companyId,
      details: {
        targetId,
        isValid: validation.isValid,
        overallScore: validation.overallScore,
        newStatus,
      },
      status: 'success',
    });

    return { target: updated, validation };
  }

  async getDashboard(companyId: string): Promise<IDashboardMetrics> {
    this.assertCompanyId(companyId);

    const targets = await this.prisma.sbtiTarget.findMany({
      where: { companyId },
      include: { progress: { orderBy: { reportingYear: 'desc' } } },
    });

    const currentYear = new Date().getFullYear();

    const summaries: IDashboardTargetSummary[] = targets.map((t) => {
      const latestProgress = t.progress[0];
      const currentTargetEmissions =
        this.progressTrackingService.calculateTargetEmissions(
          t.baseYearEmissions,
          t.reductionPercentage,
          t.baseYear,
          t.targetYear,
          currentYear,
        );

      const onTrack = latestProgress
        ? this.progressTrackingService.isOnTrack(
            latestProgress.emissions,
            currentTargetEmissions,
          )
        : false;

      const actualReduction = latestProgress
        ? ((t.baseYearEmissions - latestProgress.emissions) /
            t.baseYearEmissions) *
          100
        : 0;

      const progressPercentage =
        t.reductionPercentage > 0
          ? Math.min(
              100,
              Math.round((actualReduction / t.reductionPercentage) * 100),
            )
          : 0;

      return {
        id: t.id,
        targetType: t.targetType,
        scope: t.scope,
        status: t.status,
        targetYear: t.targetYear,
        reductionPercentage: t.reductionPercentage,
        progressPercentage,
        onTrack,
      };
    });

    const approvedTargets = targets.filter(
      (t) => t.status === 'APPROVED' || t.status === 'VALIDATED',
    ).length;

    const onTrackCount = summaries.filter((s) => s.onTrack).length;
    const approvedCount = summaries.filter(
      (s) => s.status === 'APPROVED' || s.status === 'VALIDATED',
    ).length;

    const overallScore =
      summaries.length > 0
        ? Math.round((approvedCount / summaries.length) * 100)
        : 0;

    return {
      totalTargets: targets.length,
      approvedTargets,
      onTrackTargets: onTrackCount,
      nearTermCoverage: targets.some((t) => t.targetType === 'NEAR_TERM'),
      longTermCoverage: targets.some((t) => t.targetType === 'LONG_TERM'),
      netZeroCoverage: targets.some((t) => t.targetType === 'NET_ZERO'),
      overallComplianceScore: overallScore,
      targets: summaries,
    };
  }

  async getRetirementGap(companyId: string): Promise<IRetirementGapResult> {
    this.assertCompanyId(companyId);

    const targets = await this.prisma.sbtiTarget.findMany({
      where: { companyId },
      include: { progress: { orderBy: { reportingYear: 'desc' } } },
    });

    if (!targets.length) {
      throw new BadRequestException(
        'No SBTi targets found. Create a target before calculating retirement gap.',
      );
    }

    const retirements = await this.prisma.retirement.findMany({
      where: { companyId },
      select: { amount: true, purpose: true, retiredAt: true },
    });

    const totalRetiredTonnes = retirements.reduce(
      (sum, r) => sum + r.amount,
      0,
    );

    const currentYear = new Date().getFullYear();

    const gapAnalysis: ITargetGap[] = targets.map((t) => {
      const requiredReductionTonnes =
        (t.baseYearEmissions * t.reductionPercentage) / 100;

      const yearsRemaining = Math.max(0, t.targetYear - currentYear);
      const remainingGapTonnes = Math.max(
        0,
        requiredReductionTonnes - totalRetiredTonnes,
      );
      const annualRetirementNeeded =
        yearsRemaining > 0
          ? Math.round((remainingGapTonnes / yearsRemaining) * 100) / 100
          : remainingGapTonnes;

      return {
        targetId: t.id,
        targetType: t.targetType,
        scope: t.scope,
        targetYear: t.targetYear,
        requiredReductionTonnes: Math.round(requiredReductionTonnes * 100) / 100,
        actualRetiredTonnes: totalRetiredTonnes,
        remainingGapTonnes: Math.round(remainingGapTonnes * 100) / 100,
        yearsRemaining,
        annualRetirementNeeded,
      };
    });

    const totalGap = gapAnalysis.reduce(
      (sum, g) => sum + g.remainingGapTonnes,
      0,
    );
    const maxAnnualNeeded = Math.max(
      0,
      ...gapAnalysis.map((g) => g.annualRetirementNeeded),
    );

    return {
      companyId,
      calculatedAt: new Date().toISOString(),
      gapAnalysis,
      totalGapTonnes: Math.round(totalGap * 100) / 100,
      totalRetiredToDateTonnes: totalRetiredTonnes,
      recommendedAnnualRetirements: Math.round(maxAnnualNeeded * 100) / 100,
    };
  }

  async getSubmissionPackage(companyId: string) {
    this.assertCompanyId(companyId);

    const targets = await this.prisma.sbtiTarget.findMany({
      where: { companyId },
      include: { progress: true },
    });

    if (!targets.length) {
      throw new BadRequestException('No SBTi targets found for submission.');
    }

    const validationResults = targets.map((t) =>
      this.validationService.validate({
        targetType: t.targetType as any,
        scope: t.scope as any,
        baseYear: t.baseYear,
        baseYearEmissions: t.baseYearEmissions,
        targetYear: t.targetYear,
        reductionPercentage: t.reductionPercentage,
      }),
    );

    const progressRecords = targets.flatMap((t) =>
      t.progress.map((p) => ({
        targetId: t.id,
        reportingYear: p.reportingYear,
        emissions: p.emissions,
        targetEmissions: p.targetEmissions,
        variance: p.variance,
        onTrack: p.onTrack,
      })),
    );

    const pkg = this.submissionService.buildSubmissionPackage({
      companyId,
      targets: targets as ISbtiTarget[],
      validationResults,
      progressRecords,
    });

    await this.securityService.logEvent({
      eventType: 'sbti.submission.prepared' as any,
      companyId,
      details: {
        submissionId: pkg.submissionId,
        targetCount: targets.length,
        status: pkg.status,
      },
      status: 'success',
    });

    return pkg;
  }

  private assertCompanyId(
    companyId: string | undefined,
  ): asserts companyId is string {
    if (!companyId) {
      throw new NotFoundException('Company context is required');
    }
  }
}
