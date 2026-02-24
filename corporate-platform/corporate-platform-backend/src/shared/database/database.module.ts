import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { UnitOfWorkService } from './unit-of-work.service';
import { ActivityRepository } from './repositories/activity.repository';
import { CartRepository } from './repositories/cart.repository';
import { CompanyRepository } from './repositories/company.repository';
import { ComplianceRepository } from './repositories/compliance.repository';
import { CreditRepository } from './repositories/credit.repository';
import { PortfolioRepository } from './repositories/portfolio.repository';
import { ProjectRepository } from './repositories/project.repository';
import { ReportRepository } from './repositories/report.repository';
import { RetirementRepository } from './repositories/retirement.repository';
import { TransactionRepository } from './repositories/transaction.repository';
import { UserRepository } from './repositories/user.repository';

const repositories = [
  ActivityRepository,
  CartRepository,
  CompanyRepository,
  ComplianceRepository,
  CreditRepository,
  PortfolioRepository,
  ProjectRepository,
  ReportRepository,
  RetirementRepository,
  TransactionRepository,
  UserRepository,
];

@Global()
@Module({
  providers: [PrismaService, UnitOfWorkService, ...repositories],
  exports: [
    PrismaService,
    UnitOfWorkService,
    ...repositories,
  ],
})
export class DatabaseModule {}
