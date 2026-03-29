import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateMaterialityAssessmentDto } from '../dto/assessment.dto';

@Injectable()
export class MaterialityAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createAssessment(
    companyId: string,
    dto: CreateMaterialityAssessmentDto,
  ) {
    // Simple logic for double materiality
    const doubleMateriality = {
      impactMateriality: dto.impacts,
      financialMateriality: dto.risks,
      summary: 'Combined assessment of impacts and risks.',
    };

    return this.prisma.materialityAssessment.create({
      data: {
        companyId,
        assessmentYear: dto.assessmentYear,
        impacts: dto.impacts,
        risks: dto.risks,
        status: 'DRAFT',
        doubleMateriality,
        metadata: dto.metadata,
      },
    });
  }

  async getCurrent(companyId: string) {
    return this.prisma.materialityAssessment.findFirst({
      where: { companyId },
      orderBy: { assessmentYear: 'desc' },
    });
  }
}
