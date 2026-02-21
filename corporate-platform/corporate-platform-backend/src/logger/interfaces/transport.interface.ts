import { LogEntry } from './log-entry.interface';

export interface LogTransport {
  log(entry: LogEntry): Promise<void> | void;
}
