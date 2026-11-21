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
            setNX: jest.fn(),
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

    it('should handle incoming messages successfully and use idempotency', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

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

      cacheService.setNX.mockResolvedValue(true); // claim succeeded

      await eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '10',
        },
        heartbeat: jest.fn(),
      });

      expect(cacheService.setNX).toHaveBeenCalledWith(
        'event_bus:processed:event-1',
        true,
        86400,
      );
      expect(handler).toHaveBeenCalledWith(event);
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 0, offset: '11' }, // offset + 1
      ]);
    });

    it('should skip already processed messages', async () => {
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

      cacheService.setNX.mockResolvedValue(false); // Already claimed

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

    it('should route to DLQ after max retries', async () => {
      const handler = jest
        .fn()
        .mockRejectedValue(new Error('Processing Failed'));

      let eachMessageHandler: any;
      mockConsumer.run.mockImplementation(async (config) => {
        eachMessageHandler = config.eachMessage;
      });

      await service.consume('group1', 'topic1', handler, 1); // max 1 retries

      const event = {
        id: 'event-3',
        type: 'test.type',
        source: 'test.source',
        version: '1',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation',
        data: {},
      };

      cacheService.setNX.mockResolvedValue(true); // claim succeeded

      await eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '30',
        },
        heartbeat: jest.fn(),
      });

      // Called 2 times (1 initial + 1 retries)
      expect(handler).toHaveBeenCalledTimes(2);
      expect(dlqService.routeToDlq).toHaveBeenCalledWith(
        'topic1',
        event,
        expect.any(Error),
      );
      // Claim released so DLQ replay can re-process the event
      expect(cacheService.del).toHaveBeenCalledWith(
        'event_bus:processed:event-3',
      );
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 0, offset: '31' },
      ]);
    });

    it('should ensure concurrent deliveries of the same event run messageHandler at most once', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      let eachMessageHandler: any;
      mockConsumer.run.mockImplementation(async (config) => {
        eachMessageHandler = config.eachMessage;
      });

      await service.consume('group1', 'topic1', handler);

      const event = {
        id: 'event-concurrent',
        type: 'test.type',
        source: 'test.source',
        version: '1',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation',
        data: {},
      };

      // First call wins the atomic claim, second call loses
      let setNXCallCount = 0;
      cacheService.setNX.mockImplementation(async () => {
        setNXCallCount++;
        // First invocation succeeds (claim won), second returns false
        return setNXCallCount === 1;
      });

      const msgPayload = {
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '50',
        },
        heartbeat: jest.fn(),
      };

      // Simulate two concurrent deliveries of the same event
      await Promise.all([
        eachMessageHandler(msgPayload),
        eachMessageHandler(msgPayload),
      ]);

      // The handler should have been called exactly once
      expect(handler).toHaveBeenCalledTimes(1);
      // setNX was called twice (once per delivery)
      expect(cacheService.setNX).toHaveBeenCalledTimes(2);
    });

    it('should proceed without dedup guard when Redis is unavailable', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      let eachMessageHandler: any;
      mockConsumer.run.mockImplementation(async (config) => {
        eachMessageHandler = config.eachMessage;
      });

      await service.consume('group1', 'topic1', handler);

      const event = {
        id: 'event-no-redis',
        type: 'test.type',
        source: 'test.source',
        version: '1',
        timestamp: new Date().toISOString(),
        correlationId: 'test-correlation',
        data: {},
      };

      // Redis unavailable — setNX returns undefined
      cacheService.setNX.mockResolvedValue(undefined);

      await eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '60',
        },
        heartbeat: jest.fn(),
      });

      // Handler still runs (fail-open)
      expect(handler).toHaveBeenCalledWith(event);
      expect(mockConsumer.commitOffsets).toHaveBeenCalled();
    });
  });
});
