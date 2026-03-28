import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { HistoryQueryService } from './history-query.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('api/v1/audit/ownership')
@UseGuards(JwtAuthGuard)
export class OwnershipHistoryController {
  constructor(private readonly queryService: HistoryQueryService) {}

  @Get('token/:tokenId')
  async getFullHistory(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.queryService.getFullHistory(tokenId);
  }

  @Get('token/:tokenId/current')
  async getCurrentOwner(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.queryService.getCurrentOwner(tokenId);
  }

  @Get('company')
  async getCompanyTokens(@CurrentUser() user: any) {
    // We expect user to have an associated companyAddress if authenticated
    return this.queryService.getCompanyTokens(user.companyId, user.walletAddress);
  }

  @Get('company/history')
  async getCompanyHistory(@CurrentUser() user: any) {
    return this.queryService.getCompanyHistory(user.walletAddress);
  }

  @Get('verify/:tokenId')
  async verifyOwnershipLineage(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.queryService.verifyOwnershipLineage(tokenId);
  }
}
