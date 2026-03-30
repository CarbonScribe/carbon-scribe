import { Injectable } from '@nestjs/common';
import {
  ISbtiCriteriaCheck,
  ISbtiValidationResult,
} from '../interfaces/sbti-target.interface';
import { CreateTargetDto } from '../dto/create-target.dto';

/**
 * Applies SBTi criteria v5.0 validation rules.
 *
 * Key thresholds:
 *  - Near-term 1.5°C pathway: ≥4.2% absolute annual reduction (≥50% by ~2030 from 2020 base)
 *  - Long-term: ≥90% absolute reduction from base year by 2050
 *  - Net-zero: ≥90% reduction across all scopes, target year ≤ 2050
 *  - Scope coverage: SCOPE1/SCOPE2/ALL requires near-term target year ≤ base year + 10
 */
@Injectable()
export class TargetValidationService {
  private readonly NEAR_TERM_MIN_REDUCTION = 42; // ≥42% over 10 years ≈ 4.2%/yr
  private readonly LONG_TERM_MIN_REDUCTION = 90; // ≥90% absolute reduction
  private readonly NET_ZERO_MIN_REDUCTION = 90;
  private readonly NEAR_TERM_MAX_HORIZON = 10; // years from base year
  private readonly LONG_TERM_MAX_YEAR = 2050;

  validate(dto: CreateTargetDto): ISbtiValidationResult {
    const criteria: ISbtiCriteriaCheck[] = [];

    switch (dto.targetType) {
      case 'NEAR_TERM':
        criteria.push(...this.validateNearTerm(dto));
        break;
      case 'LONG_TERM':
        criteria.push(...this.validateLongTerm(dto));
        break;
      case 'NET_ZERO':
        criteria.push(...this.validateNetZero(dto));
        break;
    }

    criteria.push(...this.validateCommon(dto));

    const passed = criteria.filter((c) => c.passed).length;
    const overallScore = Math.round((passed / criteria.length) * 100);
    const isValid = criteria.every((c) => c.passed);
    const recommendations = this.buildRecommendations(criteria);

    return { isValid, criteria, overallScore, recommendations };
  }

  private validateNearTerm(dto: CreateTargetDto): ISbtiCriteriaCheck[] {
    const horizon = dto.targetYear - dto.baseYear;
    const annualRate =
      horizon > 0 ? dto.reductionPercentage / horizon : 0;

    return [
      {
        criterion: '1.5°C pathway — minimum 4.2% annual reduction',
        passed: annualRate >= 4.2,
        detail: `Calculated annual rate: ${annualRate.toFixed(2)}% (required ≥4.2%)`,
      },
      {
        criterion: 'Near-term horizon ≤10 years from base year',
        passed: horizon <= this.NEAR_TERM_MAX_HORIZON,
        detail: `Horizon: ${horizon} years (required ≤${this.NEAR_TERM_MAX_HORIZON})`,
      },
      {
        criterion: 'Minimum 42% total reduction over target period',
        passed: dto.reductionPercentage >= this.NEAR_TERM_MIN_REDUCTION,
        detail: `Reduction: ${dto.reductionPercentage}% (required ≥${this.NEAR_TERM_MIN_REDUCTION}%)`,
      },
    ];
  }

  private validateLongTerm(dto: CreateTargetDto): ISbtiCriteriaCheck[] {
    return [
      {
        criterion: '≥90% absolute emission reduction from base year',
        passed: dto.reductionPercentage >= this.LONG_TERM_MIN_REDUCTION,
        detail: `Reduction: ${dto.reductionPercentage}% (required ≥${this.LONG_TERM_MIN_REDUCTION}%)`,
      },
      {
        criterion: 'Target year must be 2050 or earlier',
        passed: dto.targetYear <= this.LONG_TERM_MAX_YEAR,
        detail: `Target year: ${dto.targetYear} (required ≤${this.LONG_TERM_MAX_YEAR})`,
      },
    ];
  }

  private validateNetZero(dto: CreateTargetDto): ISbtiCriteriaCheck[] {
    return [
      {
        criterion: '≥90% absolute reduction across all scopes',
        passed: dto.reductionPercentage >= this.NET_ZERO_MIN_REDUCTION,
        detail: `Reduction: ${dto.reductionPercentage}% (required ≥${this.NET_ZERO_MIN_REDUCTION}%)`,
      },
      {
        criterion: 'Net-zero scope must cover ALL scopes',
        passed: dto.scope === 'ALL',
        detail: `Scope: ${dto.scope} (required ALL for net-zero)`,
      },
      {
        criterion: 'Target year must be 2050 or earlier',
        passed: dto.targetYear <= this.LONG_TERM_MAX_YEAR,
        detail: `Target year: ${dto.targetYear} (required ≤${this.LONG_TERM_MAX_YEAR})`,
      },
    ];
  }

  private validateCommon(dto: CreateTargetDto): ISbtiCriteriaCheck[] {
    return [
      {
        criterion: 'Base year emissions must be positive',
        passed: dto.baseYearEmissions > 0,
        detail: `Base year emissions: ${dto.baseYearEmissions} tCO₂e`,
      },
      {
        criterion: 'Target year must be after base year',
        passed: dto.targetYear > dto.baseYear,
        detail: `Base year: ${dto.baseYear}, Target year: ${dto.targetYear}`,
      },
    ];
  }

  private buildRecommendations(criteria: ISbtiCriteriaCheck[]): string[] {
    return criteria
      .filter((c) => !c.passed)
      .map((c) => `Fix: ${c.criterion} — ${c.detail}`);
  }
}
