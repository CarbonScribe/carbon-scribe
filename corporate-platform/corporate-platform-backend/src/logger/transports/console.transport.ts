import { LogTransport } from '../interfaces/transport.interface';
import { LogEntry } from '../interfaces/log-entry.interface';
import { LogFormat } from '../../config/interfaces/logging-config.interface';
import { formatStructured } from '../formatters/structured.formatter';

/**
 * Console Transport with support for both JSON and pretty-printed output.
 * Pretty-printed output includes color coding, structured fields, and error details.
 */
export class ConsoleTransport implements LogTransport {
  private readonly format: LogFormat;

  constructor(format: LogFormat) {
    this.format = format;
  }

  async log(entry: LogEntry): Promise<void> {
    if (!entry) {
      return;
    }

    if (this.format === 'json') {
      // Use structured formatter for JSON output
      const payload = formatStructured(entry);
      this.writeToConsole(entry.level, payload);
      return;
    }

    // Pretty print with colors and structured formatting
    const payload = this.formatPretty(entry);
    this.writeToConsole(entry.level, payload);

    // Additional details for errors
    if (entry.error) {
      const errorDetails = this.formatErrorDetails(entry);
      // eslint-disable-next-line no-console
      console.error(errorDetails);
    }

    // Additional details for metadata
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      // eslint-disable-next-line no-console
      console.log('  Metadata:', JSON.stringify(entry.metadata, null, 2));
    }
  }

  /**
   * Formats a log entry as a human-readable string with colors
   */
  private formatPretty(entry: LogEntry): string {
    const levelColors: Record<string, string> = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m', // Green
      warn: '\x1b[33m', // Yellow
      error: '\x1b[31m', // Red
      fatal: '\x1b[41m\x1b[37m', // Red background, white text
    };

    const reset = '\x1b[0m';
    const level = entry.level.toUpperCase();
    const color = levelColors[entry.level] || '';

    // Build the main log line
    const parts = [
      `[${entry.timestamp}]`,
      `${color}${level}${reset}`,
      `[${entry.service}]`,
      entry.message,
    ];

    // Add structured fields if present
    if (entry.requestId) {
      parts.push(`req=${entry.requestId}`);
    }
    if (entry.userId) {
      parts.push(`user=${entry.userId}`);
    }
    if (entry.companyId) {
      parts.push(`company=${entry.companyId}`);
    }
    if (entry.duration !== undefined) {
      parts.push(`duration=${entry.duration}ms`);
    }
    if (entry.workflowStage) {
      parts.push(`stage=${entry.workflowStage}`);
      if (entry.step !== undefined) {
        parts.push(`step=${entry.step}`);
      }
    }
    if (entry.traceId) {
      parts.push(`trace=${entry.traceId}`);
    }
    if (entry.spanId) {
      parts.push(`span=${entry.spanId}`);
    }
    if (entry.apiVersion) {
      parts.push(`api=${entry.apiVersion}`);
    }
    if (entry.statusCode) {
      parts.push(`status=${entry.statusCode}`);
    }

    // Add domain fields if present
    if (entry.domainFields) {
      const domainParts = Object.entries(entry.domainFields)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`);
      if (domainParts.length > 0) {
        parts.push(`domain=[${domainParts.join(', ')}]`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Formats error details for pretty printing
   */
  private formatErrorDetails(entry: LogEntry): string {
    if (!entry.error) {
      return '';
    }

    const lines: string[] = [];
    lines.push(`  Error: ${entry.error.name}: ${entry.error.message}`);

    if (entry.errorCode) {
      lines.push(`  Error Code: ${entry.errorCode}`);
    }

    if (entry.causedBy) {
      lines.push(`  Caused By: ${entry.causedBy}`);
    }

    if (entry.error.stack) {
      const stackLines = entry.error.stack.split('\n');
      if (stackLines.length > 1) {
        lines.push(`  Stack: ${stackLines.slice(1).join('\n    ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Writes the payload to the appropriate console method
   */
  private writeToConsole(level: string, payload: string): void {
    if (level === 'error' || level === 'fatal') {
      // eslint-disable-next-line no-console
      console.error(payload);
    } else {
      // eslint-disable-next-line no-console
      console.log(payload);
    }
  }
}
