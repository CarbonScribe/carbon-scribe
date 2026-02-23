import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { ValidationService } from './validation.service';
import { RetireCreditsDto } from '../dto/retire-credits.dto';

@Injectable()
export class InstantRetirementService {
  constructor(
    private prisma: PrismaService,
    private validationService: ValidationService,
  ) {}

  async retire(companyId: string, userId: string, dto: RetireCreditsDto) {
    // 1. Validate
    await this.validationService.validateRetirement(
      companyId,
      dto.creditId,
      dto.amount,
    );

    return (this.prisma as any).$transaction(async (tx: any) => {
      // 2. Decrease availability
      await tx.credit.update({
        where: { id: dto.creditId },
        data: { available: { decrement: dto.amount } },
      });

      // 3. Create retirement record
      const retirement = await tx.retirement.create({
        data: {
          companyId,
          userId,
          creditId: dto.creditId,
          amount: dto.amount,
          purpose: dto.purpose,
          purposeDetails: dto.purposeDetails,
          priceAtRetirement: 10.0, // Mock price for now
          transactionHash: `tx_${Math.random().toString(36).substring(7)}`,
          transactionUrl: 'https://stellar.expert/explorer/testnet/tx/...',
          verifiedAt: new Date(),
        },
        include: {
          company: true,
          credit: true,
        },
      });

      // 4. Update retirement with serial number/certificate placeholder
      const serialNumber = `RET-${new Date().getFullYear()}-${retirement.id
        .slice(-6)
        .toUpperCase()}`;

      const updatedRetirement = await tx.retirement.update({
        where: { id: retirement.id },
        data: {
          certificateId: serialNumber,
        },
        include: {
          company: true,
          credit: true,
        },
      });

      return updatedRetirement;
    });
  }
}
