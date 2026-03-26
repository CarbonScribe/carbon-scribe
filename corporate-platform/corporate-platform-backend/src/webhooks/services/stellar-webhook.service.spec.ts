import { Test, TestingModule } from '@nestjs/testing';
// Fixed linting issues
import { StellarWebhookService } from './stellar-webhook.service';
import { PrismaService } from '../../shared/database/prisma.service';
import {
  OperationType,
  TransactionStatus,
} from '../interfaces/webhook.interface';
import { NotFoundException } from '@nestjs/common';

describe('StellarWebhookService', () => {
  let service: StellarWebhookService;

  const mockPrismaService = {
    transactionConfirmation: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    webhookDelivery: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarWebhookService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<StellarWebhookService>(StellarWebhookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerTransaction', () => {
    it('should register a transaction confirmation', async () => {
      const dto = {
        transactionHash: 'hash123',
        status: TransactionStatus.PENDING,
        operationType: OperationType.TRANSFER,
        companyId: 'company1',
      };

      (
        mockPrismaService.transactionConfirmation.upsert as jest.Mock
      ).mockResolvedValue({ id: '1', ...dto });

      const result = await service.registerTransaction(dto);

      expect(result.id).toBe('1');
      expect(
        mockPrismaService.transactionConfirmation.upsert,
      ).toHaveBeenCalled();
    });
  });

  describe('getTransactionStatus', () => {
    it('should return status if transaction exists', async () => {
      (
        mockPrismaService.transactionConfirmation.findUnique as jest.Mock
      ).mockResolvedValue({
        transactionHash: 'hash123',
        status: TransactionStatus.CONFIRMED,
        confirmations: 3,
        finalizedAt: new Date(),
      });

      const result = await service.getTransactionStatus('hash123');

      expect(result.status).toBe(TransactionStatus.CONFIRMED);
      expect(result.confirmations).toBe(3);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      (
        mockPrismaService.transactionConfirmation.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.getTransactionStatus('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
