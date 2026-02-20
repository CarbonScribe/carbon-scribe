import {
    Controller,
    Get,
    Param,
    Query,
    Res,
    NotFoundException,
    Headers,
} from '@nestjs/common';
import { Response } from 'express';
import { TransactionService } from './services/transaction.service';
import { TransactionQueryDto } from './dto/transaction-query.dto';

@Controller('transactions')
export class TransactionController {
    constructor(private readonly transactionService: TransactionService) { }

    @Get()
    async findAll(
        @Query() query: TransactionQueryDto,
        @Headers('x-company-id') companyId: string,
    ) {
        const resolvedCompanyId = companyId || 'default-company';
        return this.transactionService.findAll(resolvedCompanyId, query);
    }

    @Get('export')
    async exportCsv(
        @Headers('x-company-id') companyId: string,
        @Res() res: Response,
    ) {
        const resolvedCompanyId = companyId || 'default-company';
        const csv = await this.transactionService.exportCsv(resolvedCompanyId);

        res.set({
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="transactions.csv"',
        });

        res.send(csv);
    }

    @Get(':id')
    async findOne(
        @Param('id') id: string,
        @Headers('x-company-id') companyId: string,
    ) {
        const resolvedCompanyId = companyId || 'default-company';
        const transaction = await this.transactionService.findById(
            id,
            resolvedCompanyId,
        );
        if (!transaction) {
            throw new NotFoundException(`Transaction with ID ${id} not found`);
        }
        return transaction;
    }
}
