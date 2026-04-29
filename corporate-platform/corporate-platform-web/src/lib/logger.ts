/**
 * Centralized logging utility
 * Provides consistent logging across the application
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  levelName: string;
  message: string;
  context?: string;
  data?: any;
}

class Logger {
  private level: LogLevel;
  private context?: string;
  private isDevelopment: boolean;

  constructor(level: LogLevel = LogLevel.INFO, isDevelopment: boolean = true) {
    this.level = level;
    this.isDevelopment = isDevelopment;

    // Set log level based on environment
    if (!isDevelopment) {
      this.level = LogLevel.WARN;
    }
  }

  /**
   * Set logging context (e.g., component name)
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = undefined;
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    // Skip if below minimum log level
    if (level < this.level) {
      return;
    }

    const entry = this.createLogEntry(level, message, data);
    this.output(entry);
  }

  /**
   * Create log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    data?: any,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      levelName: LogLevel[level],
      message,
      context: this.context,
      data,
    };
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    const prefix = entry.context ? `[${entry.context}]` : "";
    const timestamp = entry.timestamp.split("T")[1].split("Z")[0]; // HH:MM:SS.mmm

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(
          `[${timestamp}] ${entry.levelName} ${prefix}`,
          entry.message,
          entry.data,
        );
        break;
      case LogLevel.INFO:
        console.info(
          `[${timestamp}] ${entry.levelName} ${prefix}`,
          entry.message,
          entry.data,
        );
        break;
      case LogLevel.WARN:
        console.warn(
          `[${timestamp}] ${entry.levelName} ${prefix}`,
          entry.message,
          entry.data,
        );
        break;
      case LogLevel.ERROR:
        console.error(
          `[${timestamp}] ${entry.levelName} ${prefix}`,
          entry.message,
          entry.data,
        );
        break;
    }
  }

  /**
   * Log API request
   */
  logApiRequest(method: string, endpoint: string, data?: any): void {
    this.debug(`API ${method} ${endpoint}`, data);
  }

  /**
   * Log API response
   */
  logApiResponse(
    method: string,
    endpoint: string,
    status: number,
    data?: any,
  ): void {
    this.debug(`API ${method} ${endpoint} → ${status}`, data);
  }

  /**
   * Log API error
   */
  logApiError(method: string, endpoint: string, error: any): void {
    this.error(`API ${method} ${endpoint} failed`, error);
  }
}

// Create singleton instance
const isDev = process.env.NEXT_PUBLIC_APP_ENV === "development";
export const logger = new Logger(isDev ? LogLevel.DEBUG : LogLevel.INFO, isDev);

export default logger;
