import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../shared/database/prisma.service';

@Injectable()
export class DevBootstrapSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevBootstrapSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.shouldSeed()) {
      return;
    }

    const seedEmail = process.env.DEV_SEED_EMAIL || 'admin@acme.com';
    const seedPassword = process.env.DEV_SEED_PASSWORD || 'Demo123!';
    const seedFirstName = process.env.DEV_SEED_FIRST_NAME || 'Admin';
    const seedLastName = process.env.DEV_SEED_LAST_NAME || 'User';
    const seedRole = process.env.DEV_SEED_ROLE || 'admin';
    const seedCompanyId = process.env.DEV_SEED_COMPANY_ID || 'seed-dev-company';
    const seedCompanyName = process.env.DEV_SEED_COMPANY_NAME || 'Acme Corp';
    const resetPassword =
      (process.env.DEV_SEED_RESET_PASSWORD || 'true').toLowerCase() !== 'false';

    try {
      const company = await this.prisma.company.upsert({
        where: { id: seedCompanyId },
        update: {
          name: seedCompanyName,
        },
        create: {
          id: seedCompanyId,
          name: seedCompanyName,
          annualRetirementTarget: 10000,
          netZeroTarget: 50000,
          netZeroTargetYear: 2030,
        },
      });

      const existingUser = await this.prisma.user.findUnique({
        where: { email: seedEmail },
      });

      const passwordHash = resetPassword
        ? await bcrypt.hash(seedPassword, 10)
        : undefined;

      if (existingUser) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            firstName: seedFirstName,
            lastName: seedLastName,
            role: seedRole,
            isActive: true,
            emailVerified: true,
            ...(resetPassword ? { password: passwordHash } : {}),
          },
        });
      } else {
        await this.prisma.user.create({
          data: {
            email: seedEmail,
            password: await bcrypt.hash(seedPassword, 10),
            firstName: seedFirstName,
            lastName: seedLastName,
            role: seedRole,
            isActive: true,
            emailVerified: true,
            companyId: company.id,
          },
        });
      }

      this.logger.log(
        `Dev seed user ready: ${seedEmail} (company=${company.name}, role=${seedRole})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Dev bootstrap seed failed: ${message}`);
    }
  }

  private shouldSeed(): boolean {
    if (process.env.NODE_ENV === 'production') {
      return false;
    }

    return (process.env.DEV_SEED_ENABLED || 'true').toLowerCase() !== 'false';
  }
}
