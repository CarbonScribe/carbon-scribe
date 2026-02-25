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

      cacheService.get.mockResolvedValue(false); // not processed

      await eachMessageHandler({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from(JSON.stringify(event)),
          offset: '10',
        },
        heartbeat: jest.fn(),
      });

      expect(cacheService.get).toHaveBeenCalledWith(
        'event_bus:processed:event-1',
      );
      expect(handler).toHaveBeenCalledWith(event);
      expect(cacheService.set).toHaveBeenCalledWith(
        'event_bus:processed:event-1',
        true,
        86400,
      );
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

      cacheService.get.mockResolvedValue(true); // Already processed

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

      cacheService.get.mockResolvedValue(false);

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
      expect(mockConsumer.commitOffsets).toHaveBeenCalledWith([
        { topic: 'topic1', partition: 0, offset: '31' },
      ]);
    });
  });
});
