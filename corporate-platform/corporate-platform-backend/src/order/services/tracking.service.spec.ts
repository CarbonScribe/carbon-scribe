import { Test, TestingModule } from '@nestjs/testing';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('TrackingService', () => {
  let service: TrackingService;

  const mockPrisma = {
    order: {
      findFirst: jest.fn(),
    },
    orderStatusEvent: {
      findMany: jest.fn(),
    },
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
    it('should return status and timeline', async () => {
      const mockOrder = {
        status: 'PROCESSING',
        statusEvents: [
          { id: 'e1', status: 'PENDING', createdAt: new Date() },
          { id: 'e2', status: 'PROCESSING', createdAt: new Date() },
        ],
      };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const result = await service.getOrderStatus('order-1', 'comp-1');
      expect(result.status).toBe('PROCESSING');
      expect(result.timeline).toHaveLength(2);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(service.getOrderStatus('missing', 'comp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatusHistory', () => {
    it('should return status events', async () => {
      mockPrisma.order.findFirst.mockResolvedValue({ id: 'order-1' });
      const mockEvents = [
        { id: 'e1', status: 'PENDING', createdAt: new Date() },
      ];
      mockPrisma.orderStatusEvent.findMany.mockResolvedValue(mockEvents);

      const result = await service.getStatusHistory('order-1', 'comp-1');
      expect(result).toEqual(mockEvents);
    });

    it('should throw NotFoundException if order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);
      await expect(
        service.getStatusHistory('missing', 'comp-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
