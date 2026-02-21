export interface CacheableOptions {
  key: string;
  ttl?: number;
  tags?: string[];
}

export interface CacheEvictOptions {
  keys?: string[];
  patterns?: string[];
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memoryUsage?: number;
  evictions?: number;
}

