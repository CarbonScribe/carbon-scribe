import { LogEntry } from '../interfaces/log-entry.interface';

export function formatPretty(entry: LogEntry): string {
  const parts: string[] = [];
  parts.push(entry.timestamp);
  parts.push(entry.level.toUpperCase());
  parts.push(entry.service);
  if (entry.requestId) {
    parts.push(`req:${entry.requestId}`);
  }
  parts.push(entry.message);
  if (entry.error) {
    parts.push(`error=${entry.error.name}:${entry.error.message}`);
  }
  return parts.join(' | ');
}
