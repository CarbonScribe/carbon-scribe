import { SorobanService } from '../../stellar/soroban/soroban.service';
import { ServiceValidator } from './service-validator';

describe('ServiceValidator Stellar validation', () => {
  let serviceValidator: ServiceValidator;
  let validateConfiguredContractMethods: jest.Mock;

  beforeEach(() => {
    validateConfiguredContractMethods = jest.fn().mockResolvedValue(undefined);
    serviceValidator = new ServiceValidator(undefined, undefined, undefined, {
      getRpcClient: () => ({
        getLatestLedger: jest.fn().mockResolvedValue({ sequence: 1 }),
      }),
      validateConfiguredContractMethods,
    } as unknown as SorobanService);
  });

  it('checks configured contract method specs after RPC connectivity', async () => {
    const result = await serviceValidator.validateStellar();

    expect(result.connected).toBe(true);
    expect(validateConfiguredContractMethods).toHaveBeenCalledTimes(1);
  });

  it('reports a configured contract method mismatch as a failed Stellar check', async () => {
    validateConfiguredContractMethods.mockRejectedValue(
      new Error('Soroban contract method validation failed'),
    );

    const result = await serviceValidator.validateStellar();

    expect(result.connected).toBe(false);
    expect(result.error).toContain('Soroban contract method validation failed');
  });
});
