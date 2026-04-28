import { CarbonAssetService } from './carbon-asset.service';

describe('CarbonAssetService', () => {
  const sorobanService = {
    simulateContractCall: jest.fn(),
  } as any;

  let service: CarbonAssetService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new CarbonAssetService(sorobanService);
  });

  it('reads balance from first supported method', async () => {
    sorobanService.simulateContractCall.mockResolvedValueOnce({ result: 42 });

    const balance = await service.getCreditBalance(
      'GD5YBPKPUX7U4P6FUK7Y24WGWIXSPNL5JL3YNKM7LSFMA2D2K7CP7G55',
    );

    expect(balance).toBe(42);
    expect(sorobanService.simulateContractCall).toHaveBeenCalled();
  });

  it('falls back to next method when first call fails', async () => {
    sorobanService.simulateContractCall
      .mockRejectedValueOnce(new Error('unsupported'))
      .mockResolvedValueOnce({ result: [11, 12] });

    const tokenIds = await service.listOwnedTokenIds(
      'GB3JDWCQZR4UV3MMN3YL4CJ4Q4YQEDYFB5V7GQXJLUOBUZ7RPDP4S6TI',
    );

    expect(tokenIds).toEqual([11, 12]);
    expect(sorobanService.simulateContractCall).toHaveBeenCalledTimes(2);
  });
});
