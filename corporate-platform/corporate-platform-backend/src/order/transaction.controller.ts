import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { TransactionService } from './services/transaction.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() query: TransactionQueryDto,
  ) {
    return this.transactionService.findAll(user.companyId, query);
  }

  @Get('export')
  async exportCsv(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const csv = await this.transactionService.exportCsv(user.companyId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=transactions.csv',
    );
    res.send(csv);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.transactionService.findById(id, user.companyId);
  }
}
