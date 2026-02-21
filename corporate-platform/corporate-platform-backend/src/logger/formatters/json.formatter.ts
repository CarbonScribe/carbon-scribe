import { LogEntry } from '../interfaces/log-entry.interface';

export function formatJson(entry: LogEntry): string {
  return JSON.stringify(entry);
}
