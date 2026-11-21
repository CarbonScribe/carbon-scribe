import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyCleanupService } from './idempotency-cleanup.service';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyCleanupService', () => {
  let cleanupService: IdempotencyCleanupService;
  let idempotencyService: jest.Mocked<IdempotencyService>;

  beforeEach(async () => {
    const mockIdempotencyService = {
      cleanupExpired: jest.fn().mockResolvedValue(12),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyCleanupService,
        { provide: IdempotencyService, useValue: mockIdempotencyService },
      ],
    }).compile();

    cleanupService = module.get<IdempotencyCleanupService>(
      IdempotencyCleanupService,
    );
    idempotencyService = module.get(IdempotencyService);
  });

  it('handleCleanup calls cleanupExpired on idempotencyService', async () => {
    const count = await cleanupService.handleCleanup();

    expect(count).toBe(12);
    expect(idempotencyService.cleanupExpired).toHaveBeenCalledTimes(1);
  });
});
