export interface DiscoverySection<T> {
  title: string;
  items: T[];
}

export interface DiscoveryResponse<T> {
  featured: T[];
  trending: T[];
  newest: T[];
  highestQuality: T[];
  bestValue: T[];
  regionalSpotlights: DiscoverySection<T>[];
}
