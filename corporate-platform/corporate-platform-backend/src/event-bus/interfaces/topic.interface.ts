export interface TopicConfig {
  name: string;
  numPartitions: number;
  retentionMs: number;
  description: string;
}
