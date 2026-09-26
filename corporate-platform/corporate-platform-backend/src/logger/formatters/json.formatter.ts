import { LogEntry } from '../interfaces/log-entry.interface';
import { formatStructured } from './structured.formatter';

export function formatJson(entry: LogEntry): string {
  return formatStructured(entry);
}
