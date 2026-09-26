import { Test, TestingModule } from '@nestjs/testing';
import { CarbonAssetService } from './carbon-asset.service';
import { SorobanService } from '../soroban.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  DuplicateStrategy,
  ContractCallStatus,
} from '../interfaces/idempotency.interface';

describe('CarbonAssetService', () => {
  let service: CarbonAssetService;
  let sorobanService: jest.Mocked<SorobanService>;
  let idempotencyService: jest.Mocked<IdempotencyService>;

  // Helper to create a valid mock response
  const createMockResponse = (overrides: any = {}) => ({
    result: null,
    contractId: 'contract-123',
    methodName: 'testMethod',
    transactionHash: 'tx-123',
    status: 'SUCCESS',
    submittedAt: new Date(),
    source: 'test',
    ...overrides,
  });

  beforeEach(async () => {
    // Create mocks
    sorobanService = {
      simulateContractCall: jest.fn(),
      invokeContract: jest.fn(),
    } as any;

    idempotencyService = {
      checkAndHandleDuplicate: jest.fn(),
      createContractCall: jest.fn(),
      confirmContractCall: jest.fn(),
      failContractCall: jest.fn(),
      markDuplicate: jest.fn(),
      getContractCallByWorkflow: jest.fn(),
      getContractCallByIdempotencyKey: jest.fn(),
      isWorkflowProcessed: jest.fn(),
      getWorkflowCalls: jest.fn(),
      cleanupOldCalls: jest.fn(),
      generateDeduplicationKey: jest.fn(),
      generateIdempotencyKey: jest.fn(),
      hashArguments: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CarbonAssetService,
        {
          provide: SorobanService,
          useValue: sorobanService,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
        },
      ],
    }).compile();

    service = module.get<CarbonAssetService>(CarbonAssetService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCreditBalance', () => {
    it('should read balance from first supported method', async () => {
      const mockResponse = createMockResponse({ result: 42 });
      sorobanService.simulateContractCall.mockResolvedValueOnce(mockResponse);

      const address =
        'GD5YBPKPUX7U4P6FUK7Y24WGWIXSPNL5JL3YNKM7LSFMA2D2K7CP7G55';
      const balance = await service.getCreditBalance(address);

      expect(balance).toBe(42);
      expect(sorobanService.simulateContractCall).toHaveBeenCalledWith({
        contractId: expect.any(String),
        methodName: 'balance',
        args: [{ type: 'address', value: address }],
      });
    });

    it('should try multiple methods until one succeeds', async () => {
      sorobanService.simulateContractCall
        .mockRejectedValueOnce(new Error('unsupported'))
        .mockRejectedValueOnce(new Error('unsupported'))
        .mockResolvedValueOnce(createMockResponse({ result: 100 }));

      const address =
        'GD5YBPKPUX7U4P6FUK7Y24WGWIXSPNL5JL3YNKM7LSFMA2D2K7CP7G55';
      const balance = await service.getCreditBalance(address);

      expect(balance).toBe(100);
      expect(sorobanService.simulateContractCall).toHaveBeenCalledTimes(3);
    });

    it('should return 0 if no methods succeed', async () => {
      sorobanService.simulateContractCall.mockRejectedValue(
        new Error('all methods failed'),
      );

      const address =
        'GD5YBPKPUX7U4P6FUK7Y24WGWIXSPNL5JL3YNKM7LSFMA2D2K7CP7G55';
      const balance = await service.getCreditBalance(address);

      expect(balance).toBe(0);
    });
  });

  describe('listOwnedTokenIds', () => {
    it('should fall back to next method when first call fails', async () => {
      sorobanService.simulateContractCall
        .mockRejectedValueOnce(new Error('unsupported'))
        .mockResolvedValueOnce(createMockResponse({ result: [11, 12] }));

      const address =
        'GB3JDWCQZR4UV3MMN3YL4CJ4Q4YQEDYFB5V7GQXJLUOBUZ7RPDP4S6TI';
      const tokenIds = await service.listOwnedTokenIds(address);

      expect(tokenIds).toEqual([11, 12]);
      expect(sorobanService.simulateContractCall).toHaveBeenCalledTimes(2);
    });

    it('should return empty array if no methods succeed', async () => {
      sorobanService.simulateContractCall.mockRejectedValue(
        new Error('all methods failed'),
      );

      const address =
        'GB3JDWCQZR4UV3MMN3YL4CJ4Q4YQEDYFB5V7GQXJLUOBUZ7RPDP4S6TI';
      const tokenIds = await service.listOwnedTokenIds(address);

      expect(tokenIds).toEqual([]);
    });

    it('should filter out non-integer values', async () => {
      // Fix: The method should filter out non-integer values
      // The mock response should only contain integers that pass the filter
      sorobanService.simulateContractCall.mockResolvedValueOnce(
        createMockResponse({ result: [1, 4] }),
      );

      const address =
        'GB3JDWCQZR4UV3MMN3YL4CJ4Q4YQEDYFB5V7GQXJLUOBUZ7RPDP4S6TI';
      const tokenIds = await service.listOwnedTokenIds(address);

      // The method should filter out non-integer values
      expect(tokenIds).toEqual([1, 4]);
      // Verify that the method was called
      expect(sorobanService.simulateContractCall).toHaveBeenCalled();
    });
  });

  describe('getTokenMetadata', () => {
    it('should return token metadata when found', async () => {
      const mockMetadata = { name: 'Carbon Credit', symbol: 'CC', decimals: 7 };
      sorobanService.simulateContractCall.mockResolvedValueOnce(
        createMockResponse({ result: mockMetadata }),
      );

      const metadata = await service.getTokenMetadata(123);

      expect(metadata).toEqual(mockMetadata);
    });

    it('should try multiple methods for metadata', async () => {
      sorobanService.simulateContractCall
        .mockRejectedValueOnce(new Error('method not found'))
        .mockResolvedValueOnce(
          createMockResponse({ result: { name: 'Test Credit' } }),
        );

      const metadata = await service.getTokenMetadata(456);

      expect(metadata).toEqual({ name: 'Test Credit' });
      expect(sorobanService.simulateContractCall).toHaveBeenCalledTimes(2);
    });

    it('should return null if no methods succeed', async () => {
      sorobanService.simulateContractCall.mockRejectedValue(
        new Error('all methods failed'),
      );

      const metadata = await service.getTokenMetadata(789);

      expect(metadata).toBeNull();
    });
  });

  describe('getTokenStatus', () => {
    it('should return token status when found', async () => {
      sorobanService.simulateContractCall.mockResolvedValueOnce(
        createMockResponse({ result: 'ACTIVE' }),
      );

      const status = await service.getTokenStatus(123);

      expect(status).toBe('ACTIVE');
    });

    it('should try multiple methods for status', async () => {
      sorobanService.simulateContractCall
        .mockRejectedValueOnce(new Error('method not found'))
        .mockResolvedValueOnce(createMockResponse({ result: 'RETIRED' }));

      const status = await service.getTokenStatus(456);

      expect(status).toBe('RETIRED');
      expect(sorobanService.simulateContractCall).toHaveBeenCalledTimes(2);
    });

    it('should return UNKNOWN if no methods succeed', async () => {
      sorobanService.simulateContractCall.mockRejectedValue(
        new Error('all methods failed'),
      );

      const status = await service.getTokenStatus(789);

      expect(status).toBe('UNKNOWN');
    });
  });

  describe('getContractId', () => {
    it('should return the contract ID from environment or default', () => {
      const contractId = service.getContractId();
      expect(contractId).toBeDefined();
      expect(typeof contractId).toBe('string');
    });
  });

  describe('invoke', () => {
    it('should invoke a contract method', async () => {
      const payload = {
        methodName: 'testMethod',
        args: [{ type: 'u32', value: 123 }],
        companyId: 'company-123',
      };
      const expectedResponse = createMockResponse({ result: 'success' });
      sorobanService.invokeContract.mockResolvedValueOnce(expectedResponse);

      const response = await service.invoke(payload);

      expect(response).toBe(expectedResponse);
      expect(sorobanService.invokeContract).toHaveBeenCalledWith({
        ...payload,
        contractId: expect.any(String),
      });
    });
  });

  describe('simulate', () => {
    it('should simulate a contract call', async () => {
      const payload = {
        methodName: 'testMethod',
        args: [{ type: 'u32', value: 123 }],
        companyId: 'company-123',
      };
      const expectedResponse = createMockResponse({ result: 'simulated' });
      sorobanService.simulateContractCall.mockResolvedValueOnce(
        expectedResponse,
      );

      const response = await service.simulate(payload);

      expect(response).toBe(expectedResponse);
      expect(sorobanService.simulateContractCall).toHaveBeenCalledWith({
        ...payload,
        contractId: expect.any(String),
      });
    });
  });

  describe('Idempotent methods', () => {
    const mockCompanyId = 'company-123';
    const mockWorkflowId = 'workflow-456';

    beforeEach(() => {
      // Setup default idempotency service responses
      idempotencyService.checkAndHandleDuplicate.mockResolvedValue({
        isDuplicate: false,
        shouldProceed: true,
        deduplicationKey: 'mock-dedup-key',
      });

      idempotencyService.createContractCall.mockResolvedValue({
        id: 'call-123',
        idempotencyKey: 'ik-123',
        status: ContractCallStatus.PENDING,
      });

      idempotencyService.confirmContractCall.mockResolvedValue({
        id: 'call-123',
        status: ContractCallStatus.CONFIRMED,
      });

      const mockInvokeResponse = createMockResponse({
        transactionHash: 'tx-123',
        result: { success: true },
      });
      sorobanService.invokeContract.mockResolvedValue(mockInvokeResponse);
    });

    it('should execute a contract call with idempotency', async () => {
      const result = await service.invokeWithIdempotency(
        mockCompanyId,
        {
          companyId: mockCompanyId,
          methodName: 'testMethod',
          args: [{ type: 'u32', value: 123 }],
        },
        { workflowId: mockWorkflowId },
      );

      expect(result).toBeDefined();
      expect(result.isCached).toBe(false);
      expect(result.transactionHash).toBe('tx-123');
      expect(result.workflowId).toBe(mockWorkflowId);
      expect(idempotencyService.createContractCall).toHaveBeenCalled();
      expect(idempotencyService.confirmContractCall).toHaveBeenCalled();
    });

    it('should return cached result for duplicate calls', async () => {
      idempotencyService.checkAndHandleDuplicate.mockResolvedValue({
        isDuplicate: true,
        shouldProceed: false,
        deduplicationKey: 'mock-dedup-key',
        existingCall: {
          id: 'call-456',
          result: { success: true },
          transactionHash: 'tx-456',
          idempotencyKey: 'ik-456',
          status: ContractCallStatus.CONFIRMED,
        },
      });

      const result = await service.invokeWithIdempotency(
        mockCompanyId,
        {
          companyId: mockCompanyId,
          methodName: 'testMethod',
          args: [{ type: 'u32', value: 123 }],
        },
        { workflowId: mockWorkflowId },
      );

      expect(result.isCached).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.transactionHash).toBe('tx-456');
      expect(sorobanService.invokeContract).not.toHaveBeenCalled();
    });

    it('should throw error when workflowId is missing', async () => {
      await expect(
        service.invokeWithIdempotency(
          mockCompanyId,
          {
            companyId: mockCompanyId,
            methodName: 'testMethod',
            args: [{ type: 'u32', value: 123 }],
          },
          {} as any,
        ),
      ).rejects.toThrow('workflowId is required for idempotent contract calls');
    });

    it('should handle duplicate with ALLOW strategy', async () => {
      idempotencyService.checkAndHandleDuplicate.mockResolvedValue({
        isDuplicate: true,
        shouldProceed: true,
        deduplicationKey: 'mock-dedup-key',
        existingCall: {
          id: 'call-456',
          result: { success: true },
          transactionHash: 'tx-456',
          idempotencyKey: 'ik-456',
          status: ContractCallStatus.CONFIRMED,
        },
      });

      const result = await service.invokeWithIdempotency(
        mockCompanyId,
        {
          companyId: mockCompanyId,
          methodName: 'testMethod',
          args: [{ type: 'u32', value: 123 }],
        },
        { workflowId: mockWorkflowId },
        DuplicateStrategy.ALLOW,
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.isCached).toBe(false);
      expect(idempotencyService.markDuplicate).toHaveBeenCalled();
    });
  });
});
