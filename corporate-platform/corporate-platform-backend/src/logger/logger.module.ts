import { Global, Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './logger.service';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { ContextInterceptor } from './context/context.interceptor';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ContextInterceptor, // Context interceptor runs first
    },
    {
      provide: 'LOGGING_INTERCEPTOR',
      useClass: LoggingInterceptor,
    },
    // Note: LoggingInterceptor is applied at the controller level, not globally
    // to avoid double-logging. Use @UseInterceptors(LoggingInterceptor) on controllers.
    RequestLoggerMiddleware,
  ],
  exports: [LoggerService, RequestLoggerMiddleware],
})
export class LoggerModule implements NestModule {
  /**
   * Configure middleware for all routes
   * RequestLoggerMiddleware runs at the HTTP layer before any interceptors
   */
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
