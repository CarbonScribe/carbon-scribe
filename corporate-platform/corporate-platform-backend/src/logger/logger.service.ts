import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ExtendedLogEntry } from './interfaces/extended-log-entry.interface';
import { LogTransport } from './interfaces/transport.interface';
import {
  LogLevel,
  LoggingConfig,
} from '../config/interfaces/logging-config.interface';
import { ConsoleTransport } from './transports/console.transport';
import { FileTransport } from './transports/file.transport';
import { ElasticTransport } from './transports/elastic.transport';
import { KafkaTransport } from './transports/kafka.transport';
import { RequestContext } from './context/request-context';
import { SensitiveDataSanitizer } from './sanitizer/sensitive-data-sanitizer';
import { LogSampler } from './sampling/log-sampler';

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
  private readonly isDevelopment: boolean;
  private readonly enableBodyLogging: boolean;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.getLoggingConfig();
    const appConfig = this.configService.getAppConfig();
    this.serviceName = appConfig.serviceName;
    this.environment = appConfig.nodeEnv;
    this.isDevelopment = this.environment === 'development';
    this.enableBodyLogging =
      process.env.LOG_BODIES === 'true' || this.isDevelopment;

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

  debug(message: string, metadata?: Partial<ExtendedLogEntry>) {
    this.logInternal('debug', message, metadata);
  }

  info(message: string, metadata?: Partial<ExtendedLogEntry>) {
    this.logInternal('info', message, metadata);
  }

  warn(message: string, metadata?: Partial<ExtendedLogEntry>) {
    this.logInternal('warn', message, metadata);
  }

  error(message: string, metadata?: Partial<ExtendedLogEntry>) {
    this.logInternal('error', message, metadata);
  }

  fatal(message: string, metadata?: Partial<ExtendedLogEntry>) {
    this.logInternal('fatal', message, metadata);
  }

  /**
   * Logs a workflow step with automatic context enrichment
   */
  logWorkflowStep(
    stage: string,
    step: number,
    message: string,
    metadata?: Partial<ExtendedLogEntry>,
  ) {
    this.info(message, {
      ...metadata,
      workflowStage: stage,
      step,
    });
  }

  /**
   * Logs with domain context fields
   */
  logDomain(
    level: LogLevel,
    message: string,
    domainFields: Record<string, string>,
    metadata?: Partial<ExtendedLogEntry>,
  ) {
    this.logInternal(level, message, {
      ...metadata,
      domainFields,
    });
  }

  private shouldLog(level: LogLevel): boolean {
    return levelPriority[level] >= levelPriority[this.config.level];
  }

  private logInternal(
    level: LogLevel,
    message: string,
    metadata?: Partial<ExtendedLogEntry>,
  ) {
    if (!this.shouldLog(level)) {
      return;
    }

    // Apply sampling
    const sampled = LogSampler.shouldSample(level);
    if (!sampled) {
      return;
    }

    // Get request context
    const context = RequestContext.get();

    // Build base log entry
    const base: Partial<ExtendedLogEntry> = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      environment: this.environment,
      message,
      requestId: context?.requestId,
      traceId: context?.traceId,
      spanId: context?.spanId,
      userId: context?.userId || metadata?.userId,
      companyId: context?.companyId || metadata?.companyId,
      ip: context?.ip,
      method: context?.method,
      path: context?.path,
      apiVersion: context?.apiVersion,
      userAgent: context?.userAgent,
      referer: context?.referer,
      workflowStage: context?.workflowStage,
      step: context?.step,
      domainFields: {
        ...context?.domainFields,
        ...metadata?.domainFields,
      },
      sampling: {
        sampled: true,
        sampleRate: level === 'debug' ? 0.05 : 0.1,
      },
    };

    // Merge with metadata
    const entry: ExtendedLogEntry = {
      ...base,
      ...metadata,
      domainFields: {
        ...base.domainFields,
        ...metadata?.domainFields,
      },
      error: metadata?.error,
      metadata: metadata?.metadata,
    } as ExtendedLogEntry;

    // Sanitize sensitive data
    const shouldSanitize = SensitiveDataSanitizer.shouldSanitize(
      level,
      this.environment,
    );
    if (shouldSanitize) {
      entry.message = SensitiveDataSanitizer.sanitize(entry.message);
      if (entry.error) {
        entry.error = SensitiveDataSanitizer.sanitize(entry.error);
      }
      if (entry.metadata) {
        entry.metadata = SensitiveDataSanitizer.sanitize(entry.metadata);
      }
    }

    // Sanitize request/response bodies in development
    if (this.isDevelopment && this.enableBodyLogging) {
      // Keep bodies as-is for development
    } else {
      // Remove bodies in production
      delete entry.requestBody;
      delete entry.responseBody;
    }

    // Send to all transports
    for (const transport of this.transports) {
      transport.log(entry);
    }
  }
}
