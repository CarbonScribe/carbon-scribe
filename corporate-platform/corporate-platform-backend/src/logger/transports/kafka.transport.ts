import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';
import { KafkaConfig } from '../../config/interfaces/kafka-config.interface';

export class KafkaTransport implements LogTransport {
  constructor(private readonly config: KafkaConfig) {}

  // Placeholder for future Kafka producer integration
  async log(entry: LogEntry): Promise<void> {
    if (!entry || !this.config) {
      return;
    }
  }
}
