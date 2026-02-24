import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SecurityService } from './security.service';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { CREDIT_VIEW } from '../rbac/constants/permissions.constants';

interface CreateWhitelistDto {
  cidr: string;
  description?: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get('whitelist')
  @Permissions(CREDIT_VIEW)
  async listWhitelist(@CurrentUser() user: JwtPayload) {
    this.ensureAdmin(user);
    return this.securityService.listWhitelist(user.companyId);
  }

  @Post('whitelist')
  @Permissions(CREDIT_VIEW)
  async addWhitelist(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateWhitelistDto,
  ) {
    this.ensureAdmin(user);
    return this.securityService.addWhitelist(
      user.companyId,
      user.sub,
      body.cidr,
      body.description,
    );
  }

  @Delete('whitelist/:id')
  @Permissions(CREDIT_VIEW)
  async removeWhitelist(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    this.ensureAdmin(user);
    return this.securityService.removeWhitelist(id, user.companyId, user.sub);
  }

  @Get('audit-logs')
  @Permissions(CREDIT_VIEW)
  async getAuditLogs(@CurrentUser() user: JwtPayload) {
    this.ensureAdmin(user);
    return this.securityService.queryAuditLogs(user.companyId);
  }

  private ensureAdmin(user: JwtPayload) {
    if ((user as any).role !== 'admin') {
      throw new Error('Admin access required');
    }
  }
}

