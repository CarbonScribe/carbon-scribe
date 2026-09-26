import { Test, TestingModule } from '@nestjs/testing';
import { RetirementService } from './retirement.service';
import { CarbonAssetService } from '../stellar/soroban/contracts/carbon-asset.service';
import { IdempotencyService } from '../stellar/soroban/idempotency/idempotency.service';
import { IdempotencyKeyService } from './idempotency/idempotency-key.service';
import { ContractCallStatus } from '../stellar/soroban/interfaces/idempotency.interface';

describe('RetirementService', () => {
  let service: RetirementService;
  let carbonAssetService: jest.Mocked<CarbonAssetService>;
  let idempotencyService: jest.Mocked<IdempotencyService>;
  let idempotencyKeyService: jest.Mocked<IdempotencyKeyService>;

  beforeEach(async () => {
    // Create mocks
    carbonAssetService = {
      invokeWithIdempotency: jest.fn(),
      getContractId: jest.fn(),
      invoke: jest.fn(),
      simulate: jest.fn(),
      getCreditBalance: jest.fn(),
      getCreditBalanceWithIdempotency: jest.fn(),
      listOwnedTokenIds: jest.fn(),
      listOwnedTokenIdsWithIdempotency: jest.fn(),
      getTokenMetadata: jest.fn(),
      getTokenMetadataWithIdempotency: jest.fn(),
      getTokenStatus: jest.fn(),
      getTokenStatusWithIdempotency: jest.fn(),
      transferWithIdempotency: jest.fn(),
      retireWithIdempotency: jest.fn(),
      mintWithIdempotency: jest.fn(),
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

    idempotencyKeyService = {
      recordFailedCall: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetirementService,
        {
          provide: CarbonAssetService,
          useValue: carbonAssetService,
        },
        {
          provide: IdempotencyService,
          useValue: idempotencyService,
        },
        {
          provide: IdempotencyKeyService,
          useValue: idempotencyKeyService,
        },
      ],
    }).compile();

    service = module.get<RetirementService>(RetirementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('retireCredits', () => {
    const mockCompanyId = 'company-123';
    const mockUserId = 'user-456';
    const mockCreditId = 'credit-789';
    const mockAmount = 100;
    const mockPurpose = 'offset';

    beforeEach(() => {
      // Setup default mocks
      idempotencyService.isWorkflowProcessed.mockResolvedValue(false);
      idempotencyService.getContractCallByWorkflow.mockResolvedValue(null);

      carbonAssetService.invokeWithIdempotency.mockResolvedValue({
        result: { success: true },
        transactionHash: 'tx-123',
        isCached: false,
        isDuplicate: false,
        callId: 'call-123',
        workflowId: 'retirement-credit-789-1234567890',
        idempotencyKey: 'ik-123',
        status: ContractCallStatus.CONFIRMED,
        originalCallId: undefined,
      });
    });

    it('should retire credits successfully', async () => {
      const result = await service.retireCredits(
        mockCompanyId,
        mockUserId,
        mockCreditId,
        mockAmount,
        mockPurpose,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.cached).toBe(false);
      expect(result.isDuplicate).toBe(false);
      expect(result.transactionHash).toBe('tx-123');
      expect(result.workflowId).toContain('retirement-');
      expect(idempotencyService.isWorkflowProcessed).toHaveBeenCalled();
      expect(carbonAssetService.invokeWithIdempotency).toHaveBeenCalled();
    });

    it('should return cached result if already processed', async () => {
      const mockCachedCall = {
        id: 'call-456',
        transactionHash: 'tx-456',
        result: { success: true },
        status: ContractCallStatus.CONFIRMED,
      };

      idempotencyService.isWorkflowProcessed.mockResolvedValue(true);
      idempotencyService.getContractCallByWorkflow.mockResolvedValue(
        mockCachedCall,
      );

      const result = await service.retireCredits(
        mockCompanyId,
        mockUserId,
        mockCreditId,
        mockAmount,
        mockPurpose,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.cached).toBe(true);
      expect(result.transactionHash).toBe('tx-456');
      expect(result.workflowId).toContain('retirement-');
      expect(result.callId).toBe('call-456');
      expect(carbonAssetService.invokeWithIdempotency).not.toHaveBeenCalled();
    });

    it('should handle duplicate retirements', async () => {
      // The mock must include originalCallId when isDuplicate is true
      carbonAssetService.invokeWithIdempotency.mockResolvedValue({
        result: { success: true },
        transactionHash: 'tx-123',
        isCached: false,
        isDuplicate: true,
        callId: 'call-123',
        workflowId: 'retirement-credit-789-1234567890',
        idempotencyKey: 'ik-123',
        status: ContractCallStatus.DUPLICATE,
        originalCallId: 'call-456', // Make sure this is included
      });

      const result = await service.retireCredits(
        mockCompanyId,
        mockUserId,
        mockCreditId,
        mockAmount,
        mockPurpose,
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.cached).toBe(false);
      // The service returns result.originalCallId from invokeWithIdempotency
      // So if the mock includes it, the service will return it
      expect(result.originalCallId).toBe('call-456');
    });

    it('should throw error when retirement fails', async () => {
      const error = new Error('Retirement failed');
      carbonAssetService.invokeWithIdempotency.mockRejectedValue(error);

      await expect(
        service.retireCredits(
          mockCompanyId,
          mockUserId,
          mockCreditId,
          mockAmount,
          mockPurpose,
        ),
      ).rejects.toThrow('Retirement failed');
    });
  });

  describe('getRetirementStatus', () => {
    const mockCompanyId = 'company-123';
    const mockWorkflowId = 'workflow-456';

    it('should return retirement status when found', async () => {
      const mockCall = {
        id: 'call-123',
        status: ContractCallStatus.CONFIRMED,
        transactionHash: 'tx-123',
        result: { success: true },
        submittedAt: new Date(),
        confirmedAt: new Date(),
        isDuplicate: false,
        workflowId: mockWorkflowId,
      };

      idempotencyService.getContractCallByWorkflow.mockResolvedValue(mockCall);

      const result = await service.getRetirementStatus(
        mockCompanyId,
        mockWorkflowId,
      );

      expect(result).toBeDefined();
      expect(result.found).toBe(true);
      expect(result.status).toBe(ContractCallStatus.CONFIRMED);
      expect(result.transactionHash).toBe('tx-123');
      expect(result.workflowId).toBe(mockWorkflowId);
      expect(idempotencyService.getContractCallByWorkflow).toHaveBeenCalledWith(
        mockCompanyId,
        mockWorkflowId,
        'retire',
      );
    });

    it('should return not found when retirement does not exist', async () => {
      idempotencyService.getContractCallByWorkflow.mockResolvedValue(null);

      const result = await service.getRetirementStatus(
        mockCompanyId,
        mockWorkflowId,
      );

      expect(result).toBeDefined();
      expect(result.found).toBe(false);
      expect(result.status).toBe('NOT_FOUND');
      expect(result.workflowId).toBe(mockWorkflowId);
    });
  });

  describe('isRetirementProcessed', () => {
    const mockCompanyId = 'company-123';
    const mockWorkflowId = 'workflow-456';

    it('should return true if retirement is processed', async () => {
      idempotencyService.isWorkflowProcessed.mockResolvedValue(true);

      const result = await service.isRetirementProcessed(
        mockCompanyId,
        mockWorkflowId,
      );

      expect(result).toBe(true);
      expect(idempotencyService.isWorkflowProcessed).toHaveBeenCalledWith(
        mockCompanyId,
        mockWorkflowId,
        'retire',
      );
    });

    it('should return false if retirement is not processed', async () => {
      idempotencyService.isWorkflowProcessed.mockResolvedValue(false);

      const result = await service.isRetirementProcessed(
        mockCompanyId,
        mockWorkflowId,
      );

      expect(result).toBe(false);
    });
  });
});
