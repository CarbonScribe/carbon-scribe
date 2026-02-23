import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

@Controller('api/v1/api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: JwtPayload) {
    return this.apiKeyService.create(dto, user);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.apiKeyService.list(user);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.apiKeyService.getById(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.apiKeyService.update(id, dto, user);
  }

  @Delete(':id')
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query('reason') reason?: string,
  ) {
    return this.apiKeyService.revoke(id, user, reason);
  }

  @Post(':id/rotate')
  async rotate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.apiKeyService.rotate(id, user);
  }

  @Get(':id/usage')
  async usage(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.apiKeyService.getUsage(id, user);
  }
}
