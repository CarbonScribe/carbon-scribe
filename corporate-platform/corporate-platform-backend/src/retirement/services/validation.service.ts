import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class ValidationService {
  constructor(private prisma: PrismaService) {}

  async validateRetirement(
    companyId: string,
    creditId: string,
    amount: number,
  ) {
    // 1. Check if credit exist and is available
    const credit = await this.prisma.credit.findUnique({
      where: { id: creditId },
    });

    if (!credit) {
      throw new NotFoundException(`Credit with ID ${creditId} not found`);
    }

    if (credit.available < amount) {
      throw new BadRequestException(
        `Insufficient credits available. Requested: ${amount}, Available: ${credit.available}`,
      );
    }

    // 2. Additional company balance checks could go here
    // For now, we assume if the credit is available in the system, the company can retire it
    // (In a real scenario, we might check company-specific bounds or locks)

    return {
      valid: true,
      available: credit.available,
      maxAllowed: credit.available,
    };
  }
}
