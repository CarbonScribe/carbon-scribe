import { BadRequestException } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { ConfigService } from '../../config/config.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SigningProvider } from '../signing/signing-provider.interface';
import { CARBON_ASSET_CONTRACT_ID } from './contracts/contract.interface';
import { SorobanService } from './soroban.service';

describe('SorobanService contract method validation', () => {
  let service: SorobanService;
  let getContractWasm: jest.SpyInstance;

  beforeEach(() => {
    service = new SorobanService(
      {
        getStellarConfig: jest.fn().mockReturnValue({
          network: 'testnet',
          sorobanRpcUrl: 'https://soroban-testnet.stellar.org:443',
        }),
      } as unknown as ConfigService,
      {} as PrismaService,
      {
        isLive: jest.fn().mockReturnValue(false),
      } as unknown as SigningProvider,
    );

    getContractWasm = jest
      .spyOn(service.getRpcClient(), 'getContractWasmByContractId')
      .mockResolvedValue(Buffer.from('wasm'));
    jest.spyOn(StellarSdk.contract.Spec, 'fromWasm').mockReturnValue({
      funcs: () => [{ name: () => Buffer.from('balance') }],
    } as unknown as StellarSdk.contract.Spec);
    jest
      .spyOn(service.getRpcClient(), 'simulateTransaction')
      .mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects unknown methods before simulating or invoking the contract', async () => {
    await expect(
      service.simulateContractCall({
        contractId: CARBON_ASSET_CONTRACT_ID,
        methodName: 'balnce',
      }),
    ).rejects.toThrow(
      new BadRequestException(
        `Method "balnce" is not exposed by contract "${CARBON_ASSET_CONTRACT_ID}"`,
      ),
    );

    await expect(
      service.invokeContract({
        companyId: 'company',
        contractId: CARBON_ASSET_CONTRACT_ID,
        methodName: 'balnce',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(service.getRpcClient().simulateTransaction).not.toHaveBeenCalled();
  });

  it('allows valid methods and caches the deployed method spec', async () => {
    await service.simulateContractCall({
      contractId: CARBON_ASSET_CONTRACT_ID,
      methodName: 'balance',
    });
    await service.simulateContractCall({
      contractId: CARBON_ASSET_CONTRACT_ID,
      methodName: 'balance',
    });

    expect(getContractWasm).toHaveBeenCalledTimes(1);
    expect(service.getRpcClient().simulateTransaction).toHaveBeenCalledTimes(2);
  });
});
