import { Injectable } from '@nestjs/common';
import { CorsiaEligibleCreditResult } from '../interfaces/corsia-eligible-credit.interface';

@Injectable()
export class VerifierService {
  private readonly eligiblePrograms = new Set([
    'VERRA',
    'GOLD_STANDARD',
    'ACR',
    'CAR',
    'ART_TREES',
  ]);

  private readonly ineligibleTypes = new Set([
    'NON_PERMANENT',
    'DOUBLE_COUNTED',
    'UNVERIFIED',
  ]);

  validateCredit(input: {
    retirementId: string;
    program?: string | null;
    creditType?: string | null;
    vintageYear?: number | null;
  }): CorsiaEligibleCreditResult {
    const reasons: string[] = [];
    const program = (input.program || '').trim().toUpperCase();
    const creditType = (input.creditType || '').trim().toUpperCase();
    const vintageYear = input.vintageYear ?? 0;

    if (!program || !this.eligiblePrograms.has(program)) {
      reasons.push(
        'Program is not listed under supported CORSIA-eligible programs.',
      );
    }

    if (!creditType) {
      reasons.push('Credit type is missing and cannot be validated.');
    } else if (this.ineligibleTypes.has(creditType)) {
      reasons.push('Credit type fails CORSIA quality criteria.');
    }

    // Vintage threshold can be tuned as CORSIA EEU criteria evolve.
    if (vintageYear < 2016) {
      reasons.push(
        'Vintage year is earlier than the configured CORSIA eligibility threshold.',
      );
    }

    const eligible = reasons.length === 0;

    return {
      retirementId: input.retirementId,
      program,
      creditType,
      vintageYear,
      eligible,
      eligibilityMemo: eligible
        ? 'Validated as CORSIA-eligible based on configured criteria.'
        : reasons.join(' '),
      reasons,
    };
  }
}
