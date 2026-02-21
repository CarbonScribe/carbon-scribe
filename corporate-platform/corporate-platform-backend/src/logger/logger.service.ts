import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { LogEntry } from './interfaces/log-entry.interface';
import { LogTransport } from './interfaces/transport.interface';
import {
  LogLevel,
  LoggingConfig,
} from '../config/interfaces/logging-config.interface';
import { ConsoleTransport } from './transports/console.transport';
import { FileTransport } from './transports/file.transport';
import { ElasticTransport } from './transports/elastic.transport';
import { KafkaTransport } from './transports/kafka.transport';

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

@Injectable()
export class LoggerService {
  private readonly transports: LogTransport[] = [];
  private readonly config: LoggingConfig;
  private readonly serviceName: string;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.getLoggingConfig();
    const appConfig = this.configService.getAppConfig();
    this.serviceName = appConfig.serviceName;
    this.environment = appConfig.nodeEnv;
    if (this.config.enableConsole) {
      this.transports.push(new ConsoleTransport(this.config.format));
    }
    if (this.config.enableFile) {
      this.transports.push(new FileTransport(this.config.logDirectory));
    }
    if (this.config.enableElastic) {
      this.transports.push(new ElasticTransport());
    }
    if (this.config.enableKafka) {
      const kafkaConfig = this.configService.getKafkaConfig();
      this.transports.push(new KafkaTransport(kafkaConfig));
    }
  }

  debug(message: string, metadata?: Partial<LogEntry>) {
    this.logInternal('debug', message, metadata);
  }

  info(message: string, metadata?: Partial<LogEntry>) {
    this.logInternal('info', message, metadata);
  }

  warn(message: string, metadata?: Partial<LogEntry>) {
    this.logInternal('warn', message, metadata);
  }

  error(message: string, metadata?: Partial<LogEntry>) {
    this.logInternal('error', message, metadata);
  }

  fatal(message: string, metadata?: Partial<LogEntry>) {
    this.logInternal('fatal', message, metadata);
  }

  private shouldLog(level: LogLevel): boolean {
    return levelPriority[level] >= levelPriority[this.config.level];
  }

  private logInternal(
    level: LogLevel,
    message: string,
    metadata?: Partial<LogEntry>,
  ) {
    if (!this.shouldLog(level)) {
      return;
    }
    const base: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      message,
    };
    const entry: LogEntry = {
      ...base,
      ...metadata,
      error: metadata?.error,
      metadata: metadata?.metadata,
    };
    for (const transport of this.transports) {
      transport.log(entry);
    }
  }
}
