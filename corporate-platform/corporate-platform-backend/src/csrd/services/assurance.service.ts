import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class AssuranceService {
  constructor(private readonly prisma: PrismaService) {}

  async updateAssurance(
    disclosureId: string,
    assuranceLevel: 'LIMITED' | 'REASONABLE',
    assuredBy: string,
  ) {
    return this.prisma.esrsDisclosure.update({
      where: { id: disclosureId },
      data: {
        assuranceLevel,
        assuredBy,
        assuredAt: new Date(),
      },
    });
  }
}
