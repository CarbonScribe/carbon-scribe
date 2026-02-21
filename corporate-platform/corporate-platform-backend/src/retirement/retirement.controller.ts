import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Res,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { InstantRetirementService } from './services/instant-retirement.service';
import { HistoryService } from './services/history.service';
import { ValidationService } from './services/validation.service';
import { CertificateService } from './services/certificate.service';
import { RetireCreditsDto } from './dto/retire-credits.dto';
import { RetirementQueryDto } from './dto/retirement-query.dto';
import { Response } from 'express';
import { PrismaService } from '../shared/database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/retirements')
export class RetirementController {
  constructor(
    private instantRetirementService: InstantRetirementService,
    private historyService: HistoryService,
    private validationService: ValidationService,
    private certificateService: CertificateService,
    private prisma: PrismaService,
  ) {}

  @Post()
  async retireCredits(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RetireCreditsDto,
  ) {
    const companyId = user.companyId;
    const userId = user.sub;
    return this.instantRetirementService.retire(companyId, userId, dto);
  }

  @Get()
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: RetirementQueryDto,
  ) {
    return this.historyService.getHistory(query);
  }

  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.historyService.getStats(user.companyId);
  }

  @Get('purposes')
  async getPurposes() {
    return ['scope1', 'scope2', 'scope3', 'corporate', 'events', 'product'];
  }

  @Get('validate')
  async validate(
    @CurrentUser() user: JwtPayload,
    @Query('creditId') creditId: string,
    @Query('amount') amount: number,
  ) {
    return this.validationService.validateRetirement(
      user.companyId,
      creditId,
      Number(amount),
    );
  }

  @Get(':id')
  async getDetails(@Param('id') id: string) {
    const retirement = await this.prisma.retirement.findUnique({
      where: { id },
      include: { credit: true, company: true },
    });
    if (!retirement) throw new NotFoundException('Retirement not found');
    return retirement;
  }

  @Get(':id/certificate')
  async downloadCertificate(@Param('id') id: string, @Res() res: Response) {
    const retirement = await this.prisma.retirement.findUnique({
      where: { id },
      include: { credit: true, company: true },
    });

    if (!retirement) throw new NotFoundException('Retirement not found');

    const certificateData = {
      certificateNumber: retirement.certificateId || `RET-${retirement.id}`,
      companyName: retirement.company.name,
      retirementDate: retirement.retiredAt,
      creditProject: retirement.credit.projectName,
      creditAmount: retirement.amount,
      creditPurpose: retirement.purpose,
      transactionHash: retirement.transactionHash,
      pdfUrl: `/api/v1/retirements/${retirement.id}/certificate`,
    };

    return this.certificateService.generateCertificate(certificateData, res);
  }

  @Get('export/csv')
  async exportCsv(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const csv = await this.historyService.exportCsv(user.companyId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=retirement-history.csv',
    );
    res.send(csv);
  }
}
