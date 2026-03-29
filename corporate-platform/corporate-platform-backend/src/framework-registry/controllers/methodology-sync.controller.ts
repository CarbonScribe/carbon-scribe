import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MethodologySyncService } from '../services/methodology-sync.service';
import {
  MethodologyListQueryDto,
  TriggerMethodologySyncDto,
} from '../dto/methodology-sync.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('api/v1/frameworks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MethodologySyncController {
  constructor(
    private readonly methodologySyncService: MethodologySyncService,
  ) {}

  @Post('methodologies/sync')
  @Roles('admin')
  async syncAll(
    @Body() dto: TriggerMethodologySyncDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.methodologySyncService.syncAllMethodologies(dto, userId);
  }

  @Post('methodologies/sync/:tokenId')
  @Roles('admin')
  async syncOne(
    @Param('tokenId', ParseIntPipe) tokenId: number,
    @CurrentUser('id') userId: string,
  ) {
    return this.methodologySyncService.syncMethodologyByTokenId(tokenId, {
      triggeredBy: userId,
    });
  }

  @Get('methodologies')
  async list(@Query() query: MethodologyListQueryDto) {
    return this.methodologySyncService.listSyncedMethodologies(query);
  }

  @Get('methodologies/:tokenId')
  async getOne(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.methodologySyncService.getSyncedMethodology(tokenId);
  }

  @Get(':code/methodologies')
  async getFrameworkMethodologies(@Param('code') code: string) {
    return this.methodologySyncService.getFrameworkMethodologies(code);
  }
}
