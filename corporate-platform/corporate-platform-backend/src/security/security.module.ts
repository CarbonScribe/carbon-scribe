import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseModule } from '../shared/database/database.module';
import { SecurityService } from './security.service';
import { AuditLogMiddleware } from './middleware/audit-log.middleware';
import { SecurityController } from './security.controller';

@Module({
  imports: [DatabaseModule],
  providers: [SecurityService],
  controllers: [SecurityController],
  exports: [SecurityService],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditLogMiddleware).forRoutes('*');
  }
}
