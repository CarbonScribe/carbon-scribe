import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CacheService } from './cache.service';
import { AdminGuard } from './admin.guard';

@Controller('admin/cache')
@UseGuards(AdminGuard)
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('stats')
  async stats() {
    return this.cacheService.getStats();
  }

  @Post('clear')
  async clearAll() {
    await this.cacheService.delByPattern('*');
    return { cleared: true };
  }
}

