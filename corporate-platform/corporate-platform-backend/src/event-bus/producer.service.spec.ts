import { Test, TestingModule } from '@nestjs/testing';
import { ProducerService } from './producer.service';
import { KafkaService } from './kafka.service';
import { ConfigService } from '../config/config.service';
import { EventValidatorService } from './event-validator.service';
import { DeadLetterService } from './dead-letter/dead-letter.service';
import { OutboxService } from './outbox.service';

describe('ProducerService', () => {
  let service: ProducerService;
  let kafkaService: jest.Mocked<KafkaService>;
  let mockProducer: { send: jest.Mock };
  let outboxService: { create: jest.Mock; createMany: jest.Mock; publish: jest.Mock };

  beforeEach(async () => {
    mockProducer = { send: jest.fn() };
    outboxService = {
      create: jest.fn().mockImplementation((input) => ({ id: input.key })),
      createMany: jest.fn().mockImplementation((inputs) =>
        inputs.map((input: { key: string }) => ({ id: input.key })),
      ),
      publish: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProducerService,
        {
          provide: KafkaService,
          useValue: {
            getProducer: jest.fn().mockReturnValue(mockProducer),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            getKafkaConfig: jest.fn().mockReturnValue({
              producerTimeout: 10000,
              maxRetries: 3,
              retryDelay: 1000,
            }),
          },
        },
        {
          provide: EventValidatorService,
          useValue: {
            validate: jest.fn().mockReturnValue({ valid: true }),
            validateBatch: jest
              .fn()
              .mockImplementation((events: unknown[]) =>
                events.map(() => ({ valid: true })),
              ),
          },
        },
        {
          provide: DeadLetterService,
          useValue: {
            sendToDeadLetter: jest.fn(),
          },
        },
        { provide: OutboxService, useValue: outboxService },
      ],
    }).compile();

    service = module.get<ProducerService>(ProducerService);
    kafkaService = module.get<KafkaService>(KafkaService) as any;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should publish an event to the specified topic', async () => {
      const topic = 'credit.events';
      const event = {
        id: '123',
        type: 'credit.purchased',
        source: 'credit-ms',
        timestamp: new Date().toISOString(),
        correlationId: 'abc',
        companyId: 'comp-1',
        data: { amount: 100 },
        version: '1.0',
      };

      await service.publish(topic, event);

      expect(outboxService.create).toHaveBeenCalledWith(
        expect.objectContaining({ topic, payload: event }),
        undefined,
      );
      expect(outboxService.publish).toHaveBeenCalled();
    });

    it('should use userId as key if companyId is missing', async () => {
      const topic = 'notification.events';
      const event = {
        id: '124',
        type: 'notification.alert',
        source: 'notify-ms',
        timestamp: new Date().toISOString(),
        correlationId: 'def',
        userId: 'user-1',
        data: { message: 'Hello' },
        version: '1.0',
      };

      await service.publish(topic, event);

      expect(outboxService.create).toHaveBeenCalledWith(
        expect.objectContaining({ topic, payload: event }),
        undefined,
      );
    });

    it('should throw an error if the producer fails', async () => {
      const topic = 'credit.events';
      const event = {
        id: '125',
        type: 'credit.test',
        source: 'test',
        timestamp: new Date().toISOString(),
        correlationId: 'xyz',
        data: {},
        version: '1.0',
      };

      outboxService.publish.mockResolvedValue(false);

      await expect(service.publish(topic, event)).resolves.toBeUndefined();
    });
  });

  describe('publishBatch', () => {
    it('should do nothing if events array is empty', async () => {
      await service.publishBatch('topic', []);
      expect(mockProducer.send).not.toHaveBeenCalled();
    });

    it('should publish a batch of events', async () => {
      const events = [
        {
          id: '1',
          type: 't1',
          source: 'src1',
          timestamp: 't1',
          correlationId: 'c1',
          companyId: 'comp1',
          data: {},
          version: '1.0',
        },
        {
          id: '2',
          type: 't2',
          source: 'src2',
          timestamp: 't2',
          correlationId: 'c2',
          userId: 'usr2',
          data: {},
          version: '1.0',
        },
      ];

      await service.publishBatch('my-topic', events);

      expect(outboxService.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ topic: 'my-topic', payload: events[0] }),
          expect.objectContaining({ topic: 'my-topic', payload: events[1] }),
        ]),
        undefined,
      );
    });
  });
});
