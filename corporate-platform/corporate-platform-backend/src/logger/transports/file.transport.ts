import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';
import { formatJson } from '../formatters/json.formatter';

export class FileTransport implements LogTransport {
  private readonly filePath: string;

  constructor(directory: string) {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    this.filePath = join(directory, 'application.log');
  }

  log(entry: LogEntry) {
    const line = `${formatJson(entry)}\n`;
    appendFileSync(this.filePath, line, { encoding: 'utf8' });
  }
}
