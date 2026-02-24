import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash('Demo123!', 10);

  const company1 = await prisma.company.upsert({
    where: { id: 'seed-company-1' },
    update: {},
    create: {
      id: 'seed-company-1',
      name: 'Acme Corp',
      annualRetirementTarget: 10000,
      netZeroTarget: 50000,
      netZeroTargetYear: 2030,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      email: 'admin@acme.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      companyId: company1.id,
    },
  });

  const project1 = await prisma.project.upsert({
    where: { id: 'seed-project-1' },
    update: {},
    create: {
      id: 'seed-project-1',
      name: 'Wind Farm Alpha',
      description: 'Renewable energy project',
      methodology: 'VCS',
      standard: 'Verified Carbon Standard',
      country: 'Brazil',
    },
  });

  await prisma.credit.upsert({
    where: { id: 'seed-credit-1' },
    update: {},
    create: {
      id: 'seed-credit-1',
      projectId: project1.id,
      projectName: 'Wind Farm Alpha',
      country: 'Brazil',
      methodology: 'VCS',
      standard: 'VCS',
      vintageYear: 2023,
      price: 12.5,
      totalAmount: 10000,
      available: 8000,
    },
  });

  await prisma.credit.upsert({
    where: { id: 'seed-credit-2' },
    update: {},
    create: {
      id: 'seed-credit-2',
      projectName: 'Solar Park Beta',
      country: 'India',
      methodology: 'CDM',
      vintageYear: 2024,
      price: 8.0,
      totalAmount: 5000,
      available: 5000,
    },
  });

  await prisma.compliance.upsert({
    where: { id: 'seed-compliance-1' },
    update: {},
    create: {
      id: 'seed-compliance-1',
      companyId: company1.id,
      framework: 'SBTi',
      status: 'in_progress',
      dueDate: new Date('2025-12-31'),
    },
  });

  await prisma.report.upsert({
    where: { id: 'seed-report-1' },
    update: {},
    create: {
      id: 'seed-report-1',
      companyId: company1.id,
      type: 'sustainability',
      name: 'Annual Sustainability Report 2024',
    },
  });

  const user = await prisma.user.findUnique({ where: { email: 'admin@acme.com' } });
  if (user) {
    await prisma.activity.create({
      data: {
        companyId: company1.id,
        userId: user.id,
        action: 'seed_data_loaded',
        entityType: 'Seed',
        metadata: {},
      },
    });
  }

  console.log('Seed completed: company, user, project, credits, compliance, report, activity.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
