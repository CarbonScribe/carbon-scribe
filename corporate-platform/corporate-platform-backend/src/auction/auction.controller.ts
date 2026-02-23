import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { AuctionService } from './auction.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { PlaceBidDto } from './dto/place-bid.dto';

// Optional: if there's a guard it can be used, we'll try to extract mock user from request for now
@Controller('api/v1/auctions')
export class AuctionController {
  constructor(private readonly auctionService: AuctionService) {}

  @Post()
  async createAuction(@Body() createAuctionDto: CreateAuctionDto) {
    return this.auctionService.createAuction(createAuctionDto);
  }

  @Get()
  async getAuctions() {
    return this.auctionService.getAuctions();
  }

  @Get(':id')
  async getAuctionById(@Param('id') id: string) {
    return this.auctionService.getAuctionById(id);
  }

  @Post(':id/start')
  async startAuction(@Param('id') id: string) {
    return this.auctionService.startAuction(id);
  }

  @Post(':id/bids')
  async placeBid(
    @Param('id') id: string,
    @Body() placeBidDto: PlaceBidDto,
    @Req() req: any,
  ) {
    // Fallbacks for testing without auth guard
    const userId = req.user?.id || 'mock-user-id';
    const companyId = req.user?.companyId || 'mock-company-id';

    return this.auctionService.placeBid(id, userId, companyId, placeBidDto);
  }

  @Get(':id/bids')
  async getAuctionBids(@Param('id') id: string) {
    return this.auctionService.getAuctionBids(id);
  }

  @Post(':id/settle')
  async settleAuction(@Param('id') id: string) {
    return this.auctionService.settleAuction(id);
  }
}
