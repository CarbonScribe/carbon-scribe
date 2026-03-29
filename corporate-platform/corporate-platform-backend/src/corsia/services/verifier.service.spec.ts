import { VerifierService } from './verifier.service';

describe('VerifierService', () => {
  const service = new VerifierService();

  it('marks valid CORSIA-eligible credits as eligible', () => {
    const result = service.validateCredit({
      retirementId: 'ret-1',
      program: 'VERRA',
      creditType: 'REDD_PLUS',
      vintageYear: 2022,
    });

    expect(result.eligible).toBe(true);
  });

  it('rejects credits failing program/vintage checks', () => {
    const result = service.validateCredit({
      retirementId: 'ret-2',
      program: 'UNKNOWN_PROGRAM',
      creditType: 'REDD_PLUS',
      vintageYear: 2012,
    });

    expect(result.eligible).toBe(false);
    expect(result.reasons?.length).toBeGreaterThan(0);
  });
});
