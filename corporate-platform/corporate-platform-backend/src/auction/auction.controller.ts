import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Put,
} from '@nestjs/common';
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { RateLimit, RateLimits } from '../rate-limit/rate-limit.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { IpWhitelistGuard } from '../security/guards/ip-whitelist.guard';
import {
  PORTFOLIO_VIEW,
  CREDIT_PURCHASE,
} from '../rbac/constants/permissions.constants';

@Controller('api/v1/auctions')
@UseGuards(JwtAuthGuard, PermissionsGuard, IpWhitelistGuard)
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Get()
  @Permissions(PORTFOLIO_VIEW)
  async getAuctions(@CurrentUser() _user: JwtPayload) {
    return this.auctionService.getAuctions();
  }

  @Get(':id')
  @Permissions(PORTFOLIO_VIEW)
  async getAuctionById(
    @CurrentUser() _user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.auctionService.getAuctionById(id);
  }

  @Post()
  @Permissions(CREDIT_PURCHASE)
  async createAuction(
    @CurrentUser() _user: JwtPayload,
    @Body() dto: CreateAuctionDto,
  ) {
    return this.auctionService.createAuction(dto);
  }

  @Put(':id/start')
  @Permissions(CREDIT_PURCHASE)
  async startAuction(
    @CurrentUser() _user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.auctionService.startAuction(id);
  }

  /**
   * Place a bid on an auction
   * Rate limited to 5 bids per minute per user per auction
   */
  @Post(':id/bids')
  @Permissions(CREDIT_PURCHASE)
  @RateLimit(RateLimits.BIDDING)
  @RateLimit(RateLimits.GLOBAL_AUCTION_BIDDING)
  async placeBid(
    @Param('id') auctionId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: PlaceBidDto,
  ) {
    return this.auctionService.placeBid(
      auctionId,
      user.sub,
      user.companyId,
      dto,
    );
  }

  @Get(':id/bids')
  @Permissions(PORTFOLIO_VIEW)
  async getAuctionBids(
    @CurrentUser() _user: JwtPayload,
    @Param('id') auctionId: string,
  ) {
    return this.auctionService.getAuctionBids(auctionId);
  }

  @Post(':id/settle')
  @Permissions(CREDIT_PURCHASE)
  async settleAuction(
    @CurrentUser() _user: JwtPayload,
    @Param('id') auctionId: string,
  ) {
    return this.auctionService.settleAuction(auctionId);
  }
}
