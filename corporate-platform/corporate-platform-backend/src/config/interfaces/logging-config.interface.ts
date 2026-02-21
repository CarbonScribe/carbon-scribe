export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogFormat = 'json' | 'pretty';

export interface LoggingConfig {
  level: LogLevel;
  format: LogFormat;
  enableConsole: boolean;
  enableFile: boolean;
  enableElastic: boolean;
  enableKafka: boolean;
  logDirectory: string;
}
