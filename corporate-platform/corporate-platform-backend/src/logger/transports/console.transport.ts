import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';
import { formatJson } from '../formatters/json.formatter';
import { formatPretty } from '../formatters/pretty.formatter';
import { LogFormat } from '../../config/interfaces/logging-config.interface';

export class ConsoleTransport implements LogTransport {
  constructor(private readonly format: LogFormat) {}

  log(entry: LogEntry) {
    const payload =
      this.format === 'json' ? formatJson(entry) : formatPretty(entry);
    if (entry.level === 'error' || entry.level === 'fatal') {
      // eslint-disable-next-line no-console
      console.error(payload);
    } else {
      // eslint-disable-next-line no-console
      console.log(payload);
    }
  }
}
