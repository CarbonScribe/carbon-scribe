import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { InitiateTransferDto, BatchTransferDto } from './dto/transfer.dto';

@Controller('api/v1')
export class StellarController {
  constructor(private readonly transferService: TransferService) {}

  @Post('stellar/transfers')
  async initiateTransfer(@Body() dto: InitiateTransferDto) {
    return this.transferService.initiateTransfer(dto);
  }

  @Post('stellar/transfers/batch')
  async batchTransfer(@Body() dto: BatchTransferDto) {
    return this.transferService.batchTransfer(dto.transfers);
  }

  @Get('purchases/:id/transfer-status')
  async getTransferStatus(@Param('id') purchaseId: string) {
    return this.transferService.getTransferStatus(purchaseId);
  }
}
