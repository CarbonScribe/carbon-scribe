import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SecurityService } from './security.service';
import { AuditLogMiddleware } from './middleware/audit-log.middleware';
import { IpWhitelistGuard } from './guards/ip-whitelist.guard';
import { SecurityController } from './security.controller';
import { PrismaService } from '../shared/database/prisma.service';

@Module({
  providers: [SecurityService, IpWhitelistGuard, PrismaService],
  controllers: [SecurityController],
  exports: [SecurityService, IpWhitelistGuard],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuditLogMiddleware).forRoutes('*');
  }
}

