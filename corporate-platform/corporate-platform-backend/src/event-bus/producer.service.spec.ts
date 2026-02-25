import { Test, TestingModule } from '@nestjs/testing';
import { ProducerService } from './producer.service';
import { KafkaService } from './kafka.service';

describe('ProducerService', () => {
  let service: ProducerService;
  let kafkaService: jest.Mocked<KafkaService>;
  let mockProducer: { send: jest.Mock };

  beforeEach(async () => {
    mockProducer = { send: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProducerService,
        {
          provide: KafkaService,
          useValue: {
            getProducer: jest.fn().mockReturnValue(mockProducer),
          },
        },
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

      expect(kafkaService.getProducer).toHaveBeenCalled();
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic,
        messages: [
          {
            key: 'comp-1',
            value: JSON.stringify(event),
          },
        ],
      });
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

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic,
        messages: [
          {
            key: 'user-1',
            value: JSON.stringify(event),
          },
        ],
      });
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

      mockProducer.send.mockRejectedValue(new Error('Kafka failed'));

      await expect(service.publish(topic, event)).rejects.toThrow(
        'Kafka failed',
      );
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

      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'my-topic',
        messages: [
          { key: 'comp1', value: JSON.stringify(events[0]) },
          { key: 'usr2', value: JSON.stringify(events[1]) },
        ],
      });
    });
  });
});
