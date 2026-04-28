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
  const ghgRequirements = [
    {
      id: 'scope-1-accounting',
      name: 'Scope 1 accounting',
      description: 'Track direct emissions from owned or controlled sources.',
    },
    {
      id: 'scope-2-accounting',
      name: 'Scope 2 accounting',
      description:
        'Track purchased electricity with location-based and market-based methodologies.',
    },
    {
      id: 'scope-3-accounting',
      name: 'Scope 3 accounting',
      description: 'Track upstream and downstream value-chain categories.',
    },
    {
      id: 'annual-inventory',
      name: 'Annual inventory',
      description: 'Aggregate annual inventories with verification visibility.',
    },
  ];
  const emissionFactors = [
    {
      source: 'EPA',
      activityType: 'FUEL',
      unit: 'gallon',
      region: 'US',
      co2ePerUnit: 8.887,
      methodology: 'Stationary combustion',
      metadata: { label: 'Gasoline combustion', scope: 1 },
    },
    {
      source: 'EPA',
      activityType: 'NATURAL_GAS',
      unit: 'therm',
      region: 'US',
      co2ePerUnit: 5.3,
      methodology: 'Stationary combustion',
      metadata: { label: 'Natural gas combustion', scope: 1 },
    },
    {
      source: 'DEFRA',
      activityType: 'ELECTRICITY',
      unit: 'kWh',
      region: 'UK',
      co2ePerUnit: 0.19338,
      methodology: 'Location-based electricity',
      metadata: { label: 'UK grid electricity', scope: 2 },
    },
    {
      source: 'EPA',
      activityType: 'ELECTRICITY',
      unit: 'kWh',
      region: 'US',
      co2ePerUnit: 0.385,
      methodology: 'Location-based electricity',
      metadata: { label: 'US grid electricity', scope: 2 },
    },
    {
      source: 'DEFRA',
      activityType: 'DISTANCE',
      unit: 'mile',
      region: 'GLOBAL',
      co2ePerUnit: 0.254,
      methodology: 'Business travel distance-based',
      metadata: {
        label: 'Business travel by car',
        scope: 3,
        category: 'BUSINESS_TRAVEL',
      },
    },
    {
      source: 'DEFRA',
      activityType: 'SPEND',
      unit: 'usd',
      region: 'GLOBAL',
      co2ePerUnit: 0.00042,
      methodology: 'Spend-based purchased goods',
      metadata: {
        label: 'Purchased goods spend-based factor',
        scope: 3,
        category: 'PURCHASED_GOODS',
      },
    },
  ];

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
      companyId: company1.id,
      name: 'Wind Farm Alpha',
      description: 'Renewable energy project',
      methodology: 'VCS',
      verificationStandard: 'Verified Carbon Standard',
      country: 'Brazil',
      startDate: new Date('2018-01-01'),
    },
  });

  await prisma.credit.upsert({
    where: { id: 'seed-credit-1' },
    update: {},
    create: {
      id: 'seed-credit-1',
      company: { connect: { id: company1.id } },
      project: { connect: { id: project1.id } },
      projectName: 'Wind Farm Alpha',
      country: 'Brazil',
      methodology: 'VCS',
      verificationStandard: 'VCS',
      vintage: 2023,
      pricePerTon: 12.5,
      totalAmount: 10000,
      availableAmount: 8000,
    },
  });

  const project2 = await prisma.project.upsert({
    where: { id: 'seed-project-2' },
    update: {},
    create: {
      id: 'seed-project-2',
      companyId: company1.id,
      name: 'Solar Park Beta',
      description: 'Solar generation project',
      methodology: 'CDM',
      verificationStandard: 'Gold Standard',
      country: 'India',
      startDate: new Date('2020-01-01'),
    },
  });

  await prisma.credit.upsert({
    where: { id: 'seed-credit-2' },
    update: {},
    create: {
      id: 'seed-credit-2',
      company: { connect: { id: company1.id } },
      project: { connect: { id: project2.id } },
      projectName: 'Solar Park Beta',
      country: 'India',
      methodology: 'CDM',
      vintage: 2024,
      pricePerTon: 8.0,
      totalAmount: 5000,
      availableAmount: 5000,
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

  await prisma.compliance.upsert({
    where: { id: 'seed-compliance-ghg-1' },
    update: {
      framework: 'GHG',
      status: 'in_progress',
      requirements: ghgRequirements as any,
      dueDate: new Date('2026-12-31'),
    },
    create: {
      id: 'seed-compliance-ghg-1',
      companyId: company1.id,
      framework: 'GHG',
      status: 'in_progress',
      requirements: ghgRequirements as any,
      dueDate: new Date('2026-12-31'),
    },
  });

  await prisma.framework.upsert({
    where: { code: 'GHG' },
    update: {
      name: 'GHG Protocol Corporate Standard',
      description:
        'Framework requirements for corporate greenhouse gas inventories.',
      requirements: ghgRequirements as any,
    },
    create: {
      code: 'GHG',
      name: 'GHG Protocol Corporate Standard',
      description:
        'Framework requirements for corporate greenhouse gas inventories.',
      requirements: ghgRequirements as any,
    },
  });

  for (const factor of emissionFactors) {
    await prisma.emissionFactor.upsert({
      where: {
        source_activityType_unit_region_validFrom: {
          source: factor.source,
          activityType: factor.activityType,
          unit: factor.unit,
          region: factor.region,
          validFrom: new Date('2025-01-01T00:00:00.000Z'),
        },
      },
      update: {
        co2ePerUnit: factor.co2ePerUnit,
        methodology: factor.methodology,
        metadata: factor.metadata as any,
        isActive: true,
      },
      create: {
        source: factor.source,
        activityType: factor.activityType,
        unit: factor.unit,
        region: factor.region,
        co2ePerUnit: factor.co2ePerUnit,
        methodology: factor.methodology,
        validFrom: new Date('2025-01-01T00:00:00.000Z'),
        metadata: factor.metadata as any,
      },
    });
  }

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

  const user = await prisma.user.findUnique({
    where: { email: 'admin@acme.com' },
  });
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

  console.log(
    'Seed completed: company, user, project, credits, compliance, report, activity, GHG framework, and emission factors.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
