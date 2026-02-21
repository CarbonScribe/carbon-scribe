import { SetMetadata } from '@nestjs/common';
import { CacheableOptions } from '../cache.interfaces';

export const CACHEABLE_METADATA_KEY = 'cache:cacheable';

export function Cacheable(options: CacheableOptions): MethodDecorator {
  return SetMetadata(CACHEABLE_METADATA_KEY, options);
}

