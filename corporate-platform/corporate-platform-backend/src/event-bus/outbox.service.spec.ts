import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  const outboxEvent = {
    create: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = {
    outboxEvent,
    $transaction: jest.fn((callback) => callback({ outboxEvent })),
  } as any;
  const kafkaService = {
    isEnabled: jest.fn(),
    getProducer: jest.fn(),
  } as any;
  const configService = {
    get: jest.fn((key: string, fallback: number) => fallback),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists before a failed Kafka send and leaves the row pending', async () => {
    const row = {
      id: 'outbox-1',
      topic: 'orders',
      payload: {},
      key: 'orders:1:created',
      status: 'pending',
      attempts: 0,
    };
    outboxEvent.create.mockResolvedValue(row);
    outboxEvent.findUnique.mockResolvedValue(row);
    outboxEvent.update.mockResolvedValue({ ...row, attempts: 1 });
    kafkaService.isEnabled.mockReturnValue(true);
    kafkaService.getProducer.mockReturnValue({
      send: jest.fn().mockRejectedValue(new Error('down')),
    });
    const service = new OutboxService(prisma, kafkaService, configService);

    const created = await service.create({
      topic: 'orders',
      payload: {},
      key: row.key,
    });
    const published = await service.publish(created.id);

    expect(outboxEvent.create).toHaveBeenCalled();
    expect(published).toBe(false);
    expect(outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { attempts: { increment: 1 } } }),
    );
  });

  it('marks a pending row published after a successful send', async () => {
    const row = {
      id: 'outbox-2',
      topic: 'orders',
      payload: { id: 2 },
      key: 'orders:2:created',
      status: 'pending',
      attempts: 0,
    };
    outboxEvent.findUnique.mockResolvedValue(row);
    outboxEvent.update.mockResolvedValue(row);
    kafkaService.isEnabled.mockReturnValue(true);
    kafkaService.getProducer.mockReturnValue({
      send: jest.fn().mockResolvedValue(undefined),
    });
    const service = new OutboxService(prisma, kafkaService, configService);

    await expect(service.publish(row.id)).resolves.toBe(true);
    expect(outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'published' }),
      }),
    );
  });

  it('relays pending rows in creation order', async () => {
    const rows = [
      {
        id: '1',
        topic: 'orders',
        payload: {},
        key: '1',
        status: 'pending',
        attempts: 0,
      },
      {
        id: '2',
        topic: 'orders',
        payload: {},
        key: '2',
        status: 'pending',
        attempts: 0,
      },
    ];
    outboxEvent.findMany.mockResolvedValue(rows);
    outboxEvent.findUnique.mockImplementation(async ({ where }: any) =>
      rows.find((row) => row.id === where.id),
    );
    outboxEvent.update.mockResolvedValue({});
    kafkaService.isEnabled.mockReturnValue(false);
    const service = new OutboxService(prisma, kafkaService, configService);

    await service.relayPending();

    expect(outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
  });
});
