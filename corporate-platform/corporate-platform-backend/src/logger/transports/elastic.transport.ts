import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';

export class ElasticTransport implements LogTransport {
  async log(entry: LogEntry): Promise<void> {
    if (!entry) {
      return;
    }
  }
}
