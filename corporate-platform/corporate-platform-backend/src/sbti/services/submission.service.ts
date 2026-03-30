import { Injectable } from '@nestjs/common';
import {
  ISbtiSubmissionPackage,
  ISbtiTarget,
  ISbtiValidationResult,
  ITargetProgressRecord,
} from '../interfaces/sbti-target.interface';

@Injectable()
export class SubmissionService {
  /**
   * Assembles an SBTi submission package from validated targets and their
   * progress records. The package can be handed off to the SBTi portal or
   * stored as an audit artifact.
   */
  buildSubmissionPackage(params: {
    companyId: string;
    targets: ISbtiTarget[];
    validationResults: ISbtiValidationResult[];
    progressRecords: ITargetProgressRecord[];
  }): ISbtiSubmissionPackage {
    const { companyId, targets, validationResults, progressRecords } = params;

    const submissionId = `SBTI-${companyId.slice(-6).toUpperCase()}-${Date.now()}`;

    const allValid = validationResults.every((v) => v.isValid);

    return {
      submissionId,
      companyId,
      generatedAt: new Date().toISOString(),
      targets,
      validationSummary: validationResults,
      progressRecords,
      status: allValid ? 'READY_FOR_SUBMISSION' : 'REQUIRES_REVISION',
    };
  }

  /**
   * Formats the submission package as a flat JSON structure suitable for
   * direct upload to the SBTi Target Validation Tool (TVT).
   */
  formatForSbtiPortal(pkg: ISbtiSubmissionPackage): Record<string, unknown> {
    return {
      submission_id: pkg.submissionId,
      company_id: pkg.companyId,
      generated_at: pkg.generatedAt,
      status: pkg.status,
      targets: pkg.targets.map((t) => ({
        target_id: t.id,
        target_type: t.targetType,
        scope: t.scope,
        base_year: t.baseYear,
        base_year_emissions_tco2e: t.baseYearEmissions,
        target_year: t.targetYear,
        reduction_percentage: t.reductionPercentage,
        validation_status: t.status,
      })),
      validation_summary: pkg.validationSummary.map((v, idx) => ({
        target_id: pkg.targets[idx]?.id,
        is_valid: v.isValid,
        overall_score: v.overallScore,
        failed_criteria: v.criteria
          .filter((c) => !c.passed)
          .map((c) => c.criterion),
        recommendations: v.recommendations,
      })),
    };
  }
}
