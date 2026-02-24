import { existsSync, mkdirSync } from 'fs';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';
import { formatJson } from '../formatters/json.formatter';

export class FileTransport implements LogTransport {
  private readonly directory: string;

  constructor(directory: string) {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    this.directory = directory;
  }

  async log(entry: LogEntry) {
    const date = new Date().toISOString().slice(0, 10);
    const filePath = join(this.directory, `application-${date}.log`);
    const line = `${formatJson(entry)}\n`;
    await appendFile(filePath, line, { encoding: 'utf8' });
  }
}
