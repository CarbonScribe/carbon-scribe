import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { CacheService } from './cache.service';

import { of } from 'rxjs';

describe('CacheInterceptor', () => {
  let interceptor: CacheInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInterceptor,
        Reflector,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(undefined),
            set: jest.fn(),
            evict: jest.fn(),
          },
        },
      ],
    }).compile();

    interceptor = module.get<CacheInterceptor>(CacheInterceptor);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should pass through without metadata', (done) => {
    const context: any = {
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    const next: any = {
      handle: () => of(1),
    };
    interceptor.intercept(context, next).subscribe((value) => {
      expect(value).toBe(1);
      done();
    });
  });
});
