import { Test, TestingModule } from '@nestjs/testing';
import { ConsumerService } from './consumer.service';
import { KafkaService } from './kafka.service';
import { DeadLetterService } from './dead-letter/dead-letter.service';
import { CacheService } from '../cache/cache.service';

describe('ConsumerService', () => {
  let service: ConsumerService;
  let kafkaService: jest.Mocked<KafkaService>;
  let dlqService: jest.Mocked<DeadLetterService>;
  let cacheService: jest.Mocked<CacheService>;

  let mockConsumer: {
    connect: jest.Mock;
    subscribe: jest.Mock;
    run: jest.Mock;
    commitOffsets: jest.Mock;
    disconnect: jest.Mock;
  };

  beforeEach(async () => {
    mockConsumer = {
      connect: jest.fn(),
      subscribe: jest.fn(),
      run: jest.fn(),
      commitOffsets: jest.fn(),
      disconnect: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsumerService,
        {
          provide: KafkaService,
          useValue: {
            createConsumer: jest.fn().mockReturnValue(mockConsumer),
          },
        },
        {
          provide: DeadLetterService,
          useValue: {
            routeToDlq: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            setIfNotExists: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConsumerService>(ConsumerService);
    kafkaService = module.get(KafkaService) as any;
    dlqService = module.get(DeadLetterService) as any;
    cacheService = module.get(CacheService) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('consume', () => {
    it('should connect, subscribe, and run the consumer', async () => {
      const handler = jest.fn();
      await service.consume('group1', 'topic1', handler);

      expect(kafkaService.createConsumer).toHaveBeenCalledWith('group1');
      expect(mockConsumer.connect).toHaveBeenCalled();
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'topic1',
        fromBeginning: false,
      });
      expect(mockConsumer.run).toHaveBeenCalled();
    });

    it('should atomically claim idempotency key BEFORE invoking messageHandler', async () => {
      const callOrder: string[] = [];
      const handler = jest.fn().mockImplementation(async () => {
        callOrder.push('messageHandler');
      });

      let eachMessageHandler: any;
      mockConsumer.run.mockImplementation(async (config) => {
        eachMessageHandler = config.eachMessage;
      });

      await service.consume('group1', 'topic1', handler);

      const event = {
        id: 'event-1',
        type: 'test.type',
        source: 'test.source',
        version: '1',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation',
        data: {},
      };

      cacheService.setIfNotExists.mockImplementation(async () => {
        callOrder.push('setIfNotExists');
        return true;
      });

      await eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '10',
        },
        heartbeat: jest.fn(),
      });

      expect(callOrder).toEqual(['setIfNotExists', 'messageHandler']);
      expect(cacheService.setIfNotExists).toHaveBeenCalledWith(
        'event_bus:processed:event-1',
        true,
        86400,
      );
      expect(handler).toHaveBeenCalledWith(event);
      expect(cacheService.set).not.toHaveBeenCalled();
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 0, offset: '11' },
      ]);
    });

    it('should execute messageHandler at most once on concurrent deliveries of the same event.id', async () => {
      const claimedKeys = new Set<string>();
      cacheService.setIfNotExists.mockImplementation(async (key: string) => {
        if (claimedKeys.has(key)) {
          return false;
        }
        claimedKeys.add(key);
        return true;
      });

      let resolveHandler!: () => void;
      const handlerBarrier = new Promise<void>((resolve) => {
        resolveHandler = resolve;
      });
      const handler = jest.fn().mockImplementation(async () => {
        await handlerBarrier;
      });

      let eachMessageHandler: any;
      mockConsumer.run.mockImplementation(async (config) => {
        eachMessageHandler = config.eachMessage;
      });

      await service.consume('group1', 'topic1', handler);

      const event = {
        id: 'event-concurrent-1',
        type: 'test.type',
        source: 'test.source',
        version: '1',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation',
        data: {},
      };

      const delivery1 = eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '100',
        },
        heartbeat: jest.fn(),
      });

      const delivery2 = eachMessageHandler({
        topic: 'topic1',
        partition: 1,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '200',
        },
        heartbeat: jest.fn(),
      });

      // Allow the in-flight first delivery to complete after the second
      // concurrent delivery has already hit the atomic claim gate.
      await Promise.resolve();
      resolveHandler();
      await Promise.all([delivery1, delivery2]);

      expect(cacheService.setIfNotExists).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 0, offset: '101' },
      ]);
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 1, offset: '201' },
      ]);
    });

    it('should skip already claimed/processed messages and commit offset', async () => {
      const handler = jest.fn();

      let eachMessageHandler: any;
      mockConsumer.run.mockImplementation(async (config) => {
        eachMessageHandler = config.eachMessage;
      });

      await service.consume('group1', 'topic1', handler);

      const event = {
        id: 'event-2',
        type: 'test.type',
        source: 'test.source',
        version: '1',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation',
        data: {},
      };

      cacheService.setIfNotExists.mockResolvedValue(false);

      await eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '20',
        },
        heartbeat: jest.fn(),
      });

      expect(handler).not.toHaveBeenCalled();
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 0, offset: '21' },
      ]);
    });

    it('should release idempotency claim and route to DLQ after max retries are exhausted', async () => {
      const handler = jest
        .fn()
        .mockRejectedValue(new Error('Processing Failed'));

      let eachMessageHandler: any;
      mockConsumer.run.mockImplementation(async (config) => {
        eachMessageHandler = config.eachMessage;
      });

      await service.consume('group1', 'topic1', handler, 1);

      const event = {
        id: 'event-3',
        type: 'test.type',
        source: 'test.source',
        version: '1',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation',
        data: {},
      };

      cacheService.setIfNotExists.mockResolvedValue(true);

      await eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '30',
        },
        heartbeat: jest.fn(),
      });

      expect(handler).toHaveBeenCalledTimes(2);
      expect(cacheService.del).toHaveBeenCalledWith(
        'event_bus:processed:event-3',
      );
      expect(dlqService.routeToDlq).toHaveBeenCalledWith(
        'topic1',
        event,
        expect.any(Error),
      );
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 0, offset: '31' },
      ]);
    });
  });
});
