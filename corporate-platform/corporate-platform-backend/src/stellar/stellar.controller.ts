import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { StellarService } from './stellar.service';
import { InitiateTransferDto, BatchTransferDto } from './dto/transfer.dto';
import { CreateWalletDto, WalletResponseDto } from './dto/wallet.dto';
import { BalanceResponseDto } from './dto/balance.dto';
import { TransactionResponseDto } from './dto/transaction.dto';
import { StellarAuthGuard } from './guards/stellar-auth.guard';

@Controller('api/v1')
export class StellarController {
  constructor(
    private readonly transferService: TransferService,
    private readonly stellarService: StellarService,
  ) {}

  // ========== Health Check ==========
  
  @Get('stellar/health')
  async healthCheck() {
    return this.stellarService.healthCheck();
  }

  // ========== Wallet Management ==========
  
  @Post('wallets')
  @HttpCode(HttpStatus.CREATED)
  async createWallet(@Body() dto: CreateWalletDto): Promise<WalletResponseDto> {
    return this.stellarService.createWallet(dto.companyId);
  }

  @Get('companies/:companyId/wallet')
  @UseGuards(StellarAuthGuard)
  async getWallet(@Param('companyId') companyId: string): Promise<WalletResponseDto> {
    return this.stellarService.getWallet(companyId);
  }

  @Get('companies/:companyId/wallet/balances')
  @UseGuards(StellarAuthGuard)
  async getBalances(@Param('companyId') companyId: string): Promise<BalanceResponseDto> {
    return this.stellarService.getBalances(companyId);
  }

  @Get('companies/:companyId/wallet/transactions')
  @UseGuards(StellarAuthGuard)
  async getTransactions(@Param('companyId') companyId: string): Promise<TransactionResponseDto[]> {
    return this.stellarService.getTransactions(companyId);
  }

  // ========== Transfer Operations ==========
  
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
