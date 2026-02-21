import { Test, TestingModule } from '@nestjs/testing';
import { TrackingService } from './tracking.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('TrackingService', () => {
  let service: TrackingService;

  const mockPrisma = {
    order: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    orderStatusEvent: {
      create: jest.fn(),
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
    it('should return order status with events', async () => {
      const now = new Date();
      mockPrisma.order.findFirst.mockResolvedValue({
        id: '1',
        status: 'processing',
        createdAt: now,
        statusEvents: [
          { id: 'evt-1', status: 'pending', createdAt: now },
          { id: 'evt-2', status: 'processing', createdAt: now },
        ],
      });

      const result = await service.getOrderStatus('1', 'comp-1');

      expect(result).toBeDefined();
      expect(result.status).toBe('processing');
      expect(result.events).toHaveLength(2);
    });

    it('should return null when order not found', async () => {
      mockPrisma.order.findFirst.mockResolvedValue(null);

      const result = await service.getOrderStatus('nonexistent', 'comp-1');

      expect(result).toBeNull();
    });

    it('should use order createdAt when no status events exist', async () => {
      const createdAt = new Date('2024-01-15');
      mockPrisma.order.findFirst.mockResolvedValue({
        id: '1',
        status: 'pending',
        createdAt,
        statusEvents: [],
      });

      const result = await service.getOrderStatus('1', 'comp-1');

      expect(result.updatedAt).toEqual(createdAt);
    });
  });

  describe('addStatusEvent', () => {
    it('should create a status event and update order status', async () => {
      const event = {
        id: 'evt-1',
        orderId: '1',
        status: 'processing',
        message: 'Processing started',
      };
      mockPrisma.orderStatusEvent.create.mockResolvedValue(event);
      mockPrisma.order.update.mockResolvedValue({});

      const result = await service.addStatusEvent(
        '1',
        'processing',
        'Processing started',
      );

      expect(result).toEqual(event);
      expect(mockPrisma.orderStatusEvent.create).toHaveBeenCalledWith({
        data: {
          orderId: '1',
          status: 'processing',
          message: 'Processing started',
        },
      });
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { status: 'processing' },
      });
    });

    it('should set completedAt when status is completed', async () => {
      mockPrisma.orderStatusEvent.create.mockResolvedValue({ id: 'evt-1' });
      mockPrisma.order.update.mockResolvedValue({});

      await service.addStatusEvent('1', 'completed');

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('getStatusHistory', () => {
    it('should return ordered status events', async () => {
      const events = [
        { id: 'evt-1', status: 'pending', createdAt: new Date('2024-01-01') },
        {
          id: 'evt-2',
          status: 'processing',
          createdAt: new Date('2024-01-02'),
        },
      ];
      mockPrisma.orderStatusEvent.findMany.mockResolvedValue(events);

      const result = await service.getStatusHistory('1');

      expect(result).toEqual(events);
      expect(mockPrisma.orderStatusEvent.findMany).toHaveBeenCalledWith({
        where: { orderId: '1' },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
