import { SetMetadata } from '@nestjs/common';
import { CacheEvictOptions } from '../cache.interfaces';

export const CACHE_EVICT_METADATA_KEY = 'cache:evict';

export function CacheEvict(options: CacheEvictOptions): MethodDecorator {
  return SetMetadata(CACHE_EVICT_METADATA_KEY, options);
}

