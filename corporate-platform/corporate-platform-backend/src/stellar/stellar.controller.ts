import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TransferService } from './transfer.service';
import { InitiateTransferDto, BatchTransferDto } from './dto/transfer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ContractCallDto } from './soroban/dto/contract-call.dto';
import { CarbonAssetService } from './soroban/contracts/carbon-asset.service';
import { RetirementTrackerService } from './soroban/contracts/retirement-tracker.service';
import {
  CARBON_ASSET_CONTRACT_ID,
  RETIREMENT_TRACKER_CONTRACT_ID,
} from './soroban/contracts/contract.interface';
import { SorobanService } from './soroban/soroban.service';
import { ContractAuthGuard } from './soroban/guards/contract-auth.guard';
import { RetirementVerificationService } from './soroban/verification/retirement-verification.service';
import { TransactionHistoryService } from './soroban/history/transaction-history.service';
import { EventListenerService } from './soroban/history/event-listener.service';
import { TransactionHistoryQueryDto } from './soroban/dto/transaction-history.dto';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class StellarController {
  constructor(
    private readonly transferService: TransferService,
    private readonly sorobanService: SorobanService,
    private readonly carbonAssetService: CarbonAssetService,
    private readonly retirementTrackerService: RetirementTrackerService,
    private readonly retirementVerificationService: RetirementVerificationService,
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly eventListenerService: EventListenerService,
  ) {}

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

  @Get('stellar/purchases/:id/transfer-status')
  async getStellarTransferStatus(@Param('id') purchaseId: string) {
    return this.transferService.getTransferStatus(purchaseId);
  }

  @Post('stellar/contract/call')
  @UseGuards(ContractAuthGuard)
  async callContract(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ContractCallDto,
  ) {
    const resolvedContractId = this.resolveContractId(dto);

    return this.sorobanService.invokeContract({
      companyId: user.companyId,
      contractId: resolvedContractId,
      methodName: dto.methodName,
      args: dto.args || [],
    });
  }

  @Post('stellar/contract/simulate')
  @UseGuards(ContractAuthGuard)
  async simulateContract(@Body() dto: ContractCallDto) {
    const resolvedContractId = this.resolveContractId(dto);

    return this.sorobanService.simulateContractCall({
      contractId: resolvedContractId,
      methodName: dto.methodName,
      args: dto.args || [],
    });
  }

  @Get('stellar/balance/credits')
  async getCreditBalance(@Query('address') address: string) {
    return {
      address,
      contractId: this.carbonAssetService.getContractId(),
      balance: await this.carbonAssetService.getCreditBalance(address),
    };
  }

  @Get('stellar/tokens')
  async getOwnedTokens(@Query('address') address: string) {
    return {
      address,
      contractId: this.carbonAssetService.getContractId(),
      tokenIds: await this.carbonAssetService.listOwnedTokenIds(address),
    };
  }

  @Get('stellar/tokens/:id/metadata')
  async getTokenMetadata(@Param('id') id: string) {
    return {
      tokenId: Number(id),
      contractId: this.carbonAssetService.getContractId(),
      metadata: await this.carbonAssetService.getTokenMetadata(Number(id)),
    };
  }

  @Get('stellar/tokens/:id/status')
  async getTokenStatus(@Param('id') id: string) {
    return {
      tokenId: Number(id),
      contractId: this.carbonAssetService.getContractId(),
      status: await this.carbonAssetService.getTokenStatus(Number(id)),
    };
  }

  @Get('retirement/verify/:txHash')
  async verifyRetirement(
    @CurrentUser() user: JwtPayload,
    @Param('txHash') txHash: string,
  ) {
    const verification =
      await this.retirementVerificationService.verifyRetirementOnChain(
        txHash,
        user.companyId,
      );

    return {
      retirementTrackerContractId:
        this.retirementTrackerService.getContractId(),
      ...verification,
    };
  }

  @Get('retirement/:txHash/proof')
  async getRetirementProof(
    @CurrentUser() user: JwtPayload,
    @Param('txHash') txHash: string,
  ) {
    return this.retirementVerificationService.getProof(txHash, user.companyId);
  }

  @Get('retirement/:txHash/certificate')
  async getRetirementCertificate(
    @CurrentUser() user: JwtPayload,
    @Param('txHash') txHash: string,
  ) {
    return this.retirementVerificationService.generateCertificate(
      txHash,
      user.companyId,
    );
  }

  @Get('stellar/transactions')
  async getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query() query: TransactionHistoryQueryDto,
  ) {
    return this.transactionHistoryService.listCompanyTransactions(
      user.companyId,
      query,
    );
  }

  @Get('stellar/transactions/:hash')
  async getTransactionDetails(
    @CurrentUser() user: JwtPayload,
    @Param('hash') hash: string,
  ) {
    return this.transactionHistoryService.getTransactionDetails(
      user.companyId,
      hash,
    );
  }

  @Get('stellar/events/:contractId')
  async getContractEvents(
    @Param('contractId') contractId: string,
    @Query('startLedger') startLedger?: string,
    @Query('limit') limit?: string,
  ) {
    return this.eventListenerService.getContractEvents(
      contractId,
      Number(startLedger || 1),
      Number(limit || 100),
    );
  }

  private resolveContractId(dto: ContractCallDto): string {
    if (dto.contractId?.trim()) {
      return dto.contractId.trim();
    }

    if (dto.contractAlias === 'carbonAsset') {
      return process.env.CARBON_ASSET_CONTRACT_ID || CARBON_ASSET_CONTRACT_ID;
    }

    if (dto.contractAlias === 'retirementTracker') {
      return (
        process.env.RETIREMENT_TRACKER_CONTRACT_ID ||
        RETIREMENT_TRACKER_CONTRACT_ID
      );
    }

    return process.env.CARBON_ASSET_CONTRACT_ID || CARBON_ASSET_CONTRACT_ID;
  }
}
