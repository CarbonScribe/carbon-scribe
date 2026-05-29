import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService, ReadinessResponse } from './health.service';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';

// Declare Jest globals to satisfy the TypeScript compiler when node_modules is not locally installed
declare const jest: any;
declare const describe: any;
declare const beforeEach: any;
declare const it: any;
declare const expect: any;

describe('HealthController', () => {
  let controller: HealthController;
  let service: jest.Mocked<HealthService>;

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            getReadiness: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get(HealthService) as any;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getLiveness', () => {
    it('should return 200 OK immediately with status healthy', () => {
      const res = mockResponse();
      controller.getLiveness(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          liveness: 'up',
        }),
      );
    });
  });

  describe('getReadiness', () => {
    it('should return 200 OK if the service reports healthy overall status', async () => {
      const res = mockResponse();
      const mockReadiness: ReadinessResponse = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.0.1',
        uptimeSeconds: 10,
        checks: {
          database: { status: 'healthy' },
          redis: { status: 'healthy' },
          kafka: { status: 'healthy' },
          ipfs: { status: 'healthy' },
          stellar: { status: 'healthy' },
        },
      };
      service.getReadiness.mockResolvedValue(mockReadiness);

      await controller.getReadiness(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.json).toHaveBeenCalledWith(mockReadiness);
    });

    it('should return 503 SERVICE_UNAVAILABLE if any dependency is unhealthy', async () => {
      const res = mockResponse();
      const mockReadiness: ReadinessResponse = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '0.0.1',
        uptimeSeconds: 10,
        checks: {
          database: { status: 'unhealthy', error: 'Connection failure' },
          redis: { status: 'healthy' },
          kafka: { status: 'healthy' },
          ipfs: { status: 'healthy' },
          stellar: { status: 'healthy' },
        },
      };
      service.getReadiness.mockResolvedValue(mockReadiness);

      await controller.getReadiness(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(res.json).toHaveBeenCalledWith(mockReadiness);
    });
  });
});
