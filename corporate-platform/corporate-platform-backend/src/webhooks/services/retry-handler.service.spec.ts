import { Test, TestingModule } from '@nestjs/testing';
import { RetryHandlerService } from './retry-handler.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { ConfigService } from '../../config/config.service';
import { WebhookStatus } from '../interfaces/webhook.interface';

describe('RetryHandlerService', () => {
  let service: RetryHandlerService;
  let prisma: PrismaService;

  const mockPrismaService = {
    webhookDelivery: {
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockConfigService = {
    getAppConfig: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetryHandlerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<RetryHandlerService>(RetryHandlerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleRetries', () => {
    it('should process retriable deliveries', async () => {
      const delivery = {
        id: '1',
        status: WebhookStatus.FAILED,
        retryCount: 0,
        nextAttemptAt: new Date(Date.now() - 1000),
      };

      (mockPrismaService.webhookDelivery.findMany as jest.Mock).mockResolvedValue([delivery]);
      (mockPrismaService.webhookDelivery.update as jest.Mock).mockResolvedValue({ ...delivery, status: WebhookStatus.RETRYING });

      await service.handleRetries();

      expect(mockPrismaService.webhookDelivery.findMany).toHaveBeenCalled();
      expect(mockPrismaService.webhookDelivery.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          status: WebhookStatus.RETRYING,
          retryCount: 1,
        }),
      });
    });
  });
});
