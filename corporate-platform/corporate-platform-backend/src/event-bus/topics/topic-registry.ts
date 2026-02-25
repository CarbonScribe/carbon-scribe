import { TopicConfig } from '../interfaces/topic.interface';

export const TOPIC_REGISTRY: Record<string, TopicConfig> = {
  CREDIT_EVENTS: {
    name: 'credit.events',
    numPartitions: 3,
    retentionMs: 604800000, // 7 days
    description: 'Credit lifecycle events',
  },
  PORTFOLIO_EVENTS: {
    name: 'portfolio.events',
    numPartitions: 3,
    retentionMs: 604800000, // 7 days
    description: 'Portfolio changes',
  },
  COMPLIANCE_EVENTS: {
    name: 'compliance.events',
    numPartitions: 2,
    retentionMs: 2592000000, // 30 days
    description: 'Compliance updates',
  },
  REPORT_EVENTS: {
    name: 'report.events',
    numPartitions: 2,
    retentionMs: 604800000, // 7 days
    description: 'Report generation',
  },
  NOTIFICATION_EVENTS: {
    name: 'notification.events',
    numPartitions: 3,
    retentionMs: 259200000, // 3 days
    description: 'User notifications',
  },
  TEAM_EVENTS: {
    name: 'team.events',
    numPartitions: 2,
    retentionMs: 604800000, // 7 days
    description: 'Team management',
  },
  MARKETPLACE_EVENTS: {
    name: 'marketplace.events',
    numPartitions: 3,
    retentionMs: 259200000, // 3 days
    description: 'Marketplace activity',
  },
  BLOCKCHAIN_EVENTS: {
    name: 'blockchain.events',
    numPartitions: 3,
    retentionMs: 2592000000, // 30 days
    description: 'On-chain events',
  },
  DEAD_LETTER_QUEUE: {
    name: 'dead-letter.queue',
    numPartitions: 1,
    retentionMs: 7776000000, // 90 days
    description: 'Failed messages for investigation',
  },
};
