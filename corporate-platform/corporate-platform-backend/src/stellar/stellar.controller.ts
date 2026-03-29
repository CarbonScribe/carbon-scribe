import { Controller, Post, Get, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { StellarService } from './stellar.service';
import { InitiateTransferDto, BatchTransferDto } from './dto/transfer.dto';
import { CreateWalletDto, WalletResponseDto } from './dto/wallet.dto';
import { BalanceResponseDto } from './dto/balance.dto';
import { TransactionResponseDto } from './dto/transaction.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StellarAuthGuard } from './guards/stellar-auth.guard';

@ApiTags('stellar')
@ApiBearerAuth()
@Controller('api/v1')
export class StellarController {
  constructor(
    private readonly transferService: TransferService,
    private readonly stellarService: StellarService,
  ) {}

  // ========== Health Check ==========
  
  @Get('stellar/health')
  @ApiOperation({ summary: 'Check Stellar network connectivity' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  async healthCheck() {
    return this.stellarService.healthCheck();
  }

  // ========== Wallet Management ==========
  
  @Post('wallets')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new corporate wallet' })
  @ApiResponse({ status: 201, description: 'Wallet created successfully', type: WalletResponseDto })
  @ApiResponse({ status: 409, description: 'Wallet already exists for company' })
  async createWallet(@Body() dto: CreateWalletDto): Promise<WalletResponseDto> {
    return this.stellarService.createWallet(dto.companyId);
  }

  @Get('companies/:companyId/wallet')
  @UseGuards(StellarAuthGuard)
  @ApiOperation({ summary: 'Get wallet for a company' })
  @ApiResponse({ status: 200, description: 'Wallet found', type: WalletResponseDto })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(@Param('companyId') companyId: string): Promise<WalletResponseDto> {
    return this.stellarService.getWallet(companyId);
  }

  @Get('companies/:companyId/wallet/balances')
  @UseGuards(StellarAuthGuard)
  @ApiOperation({ summary: 'Get wallet balances (XLM and carbon credits)' })
  @ApiResponse({ status: 200, description: 'Balances retrieved', type: BalanceResponseDto })
  async getBalances(@Param('companyId') companyId: string): Promise<BalanceResponseDto> {
    return this.stellarService.getBalances(companyId);
  }

  @Get('companies/:companyId/wallet/transactions')
  @UseGuards(StellarAuthGuard)
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved', type: [TransactionResponseDto] })
  async getTransactions(@Param('companyId') companyId: string): Promise<TransactionResponseDto[]> {
    return this.stellarService.getTransactions(companyId);
  }

  // ========== Transfer Operations ==========
  
  @Post('stellar/transfers')
  @ApiOperation({ summary: 'Initiate a transfer' })
  async initiateTransfer(@Body() dto: InitiateTransferDto) {
    return this.transferService.initiateTransfer(dto);
  }

  @Post('stellar/transfers/batch')
  @ApiOperation({ summary: 'Execute batch transfers' })
  async batchTransfer(@Body() dto: BatchTransferDto) {
    return this.transferService.batchTransfer(dto.transfers);
  }

  @Get('purchases/:id/transfer-status')
  @ApiOperation({ summary: 'Get transfer status by purchase ID' })
  async getTransferStatus(@Param('id') purchaseId: string) {
    return this.transferService.getTransferStatus(purchaseId);
  }
}
