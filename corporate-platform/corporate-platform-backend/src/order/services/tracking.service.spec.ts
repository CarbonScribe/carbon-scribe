import { Test, TestingModule } from '@nestjs/testing';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TrackingService', () => {
  let service: TrackingService;

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditLogs = [
    {
      event: 'created',
      fromStatus: null,
      toStatus: 'pending',
      userId: 'user-1',
      metadata: null,
      createdAt: new Date('2026-01-15T10:00:00Z'),
    },
    {
      event: 'confirmed',
      fromStatus: 'pending',
      toStatus: 'processing',
      userId: 'user-1',
      metadata: null,
      createdAt: new Date('2026-01-15T10:01:00Z'),
    },
    {
      event: 'confirmed',
      fromStatus: 'processing',
      toStatus: 'completed',
      userId: null,
      metadata: null,
      createdAt: new Date('2026-01-15T10:02:00Z'),
    },
  ];

  const mockOrder = {
    id: 'order-1',
    orderNumber: 'ORD-2026-0001',
    companyId: 'company-1',
    status: 'completed',
    updatedAt: new Date('2026-01-15T10:02:00Z'),
    auditLogs: mockAuditLogs,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TrackingService>(TrackingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrderStatus', () => {
    it('returns full status result with events', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderStatus('company-1', 'order-1');

      expect(result.orderId).toBe('order-1');
      expect(result.orderNumber).toBe('ORD-2026-0001');
      expect(result.status).toBe('completed');
      expect(result.events).toHaveLength(3);
      expect(result.events[0].event).toBe('created');
      expect(result.events[0].fromStatus).toBeNull();
      expect(result.events[1].toStatus).toBe('processing');
    });

    it('throws NotFoundException when order is not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.getOrderStatus('company-1', 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for cross-company access', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        companyId: 'other-company',
      });

      await expect(
        service.getOrderStatus('company-1', 'order-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('parses JSON metadata on audit log events', async () => {
      const orderWithMetadata = {
        ...mockOrder,
        status: 'failed',
        auditLogs: [
          {
            event: 'failed',
            fromStatus: 'processing',
            toStatus: 'failed',
            userId: null,
            metadata: JSON.stringify({ reason: 'Payment declined' }),
            createdAt: new Date(),
          },
        ],
      };
      mockPrisma.order.findUnique.mockResolvedValue(orderWithMetadata);

      const result = await service.getOrderStatus('company-1', 'order-1');

      expect(result.events[0].metadata).toEqual({
        reason: 'Payment declined',
      });
      expect(result.failureReason).toBe('Payment declined');
    });

    it('handles malformed JSON metadata without throwing', async () => {
      const orderWithBadMetadata = {
        ...mockOrder,
        auditLogs: [
          {
            event: 'created',
            fromStatus: null,
            toStatus: 'pending',
            userId: null,
            metadata: 'not-valid-json',
            createdAt: new Date(),
          },
        ],
      };
      mockPrisma.order.findUnique.mockResolvedValue(orderWithBadMetadata);

      const result = await service.getOrderStatus('company-1', 'order-1');

      expect(result.events[0].metadata).toBeUndefined();
    });

    it('returns undefined failureReason for orders without failures', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await service.getOrderStatus('company-1', 'order-1');

      expect(result.failureReason).toBeUndefined();
    });

    it('returns empty events array when no audit logs exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        ...mockOrder,
        auditLogs: [],
      });

      const result = await service.getOrderStatus('company-1', 'order-1');

      expect(result.events).toEqual([]);
    });
  });
});
