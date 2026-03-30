# CBAM Module Migration Guide

## Quick Start

### 1. Install Dependencies (if needed)
```bash
cd corporate-platform/corporate-platform-backend
npm install
```

### 2. Generate Prisma Client
```bash
npx prisma generate
```

### 3. Run Database Migration
```bash
npx prisma migrate dev --name add_cbam_models
```

This will:
- Create the `CbamGoods` table
- Create the `ImportDeclaration` table
- Create the `CbamQuarterlyReport` table
- Add relations to the `Company` model

### 4. Apply to Production Database
```bash
npx prisma migrate deploy
```

## Manual Migration (Alternative)

If you prefer to run SQL directly, here's the migration SQL:

```sql
-- CbamGoods table
CREATE TABLE "cbam_goods" (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL REFERENCES "Company"(id),
    "cnCode" TEXT NOT NULL,
    "goodsName" TEXT NOT NULL,
    sector TEXT NOT NULL,
    "defaultValue" DOUBLE PRECISION,
    unit TEXT NOT NULL,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL
);

-- ImportDeclaration table
CREATE TABLE "import_declarations" (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL REFERENCES "Company"(id),
    "goodsId" TEXT NOT NULL REFERENCES "cbam_goods"(id),
    "importDate" TIMESTAMP(3) NOT NULL,
    quantity DOUBLE PRECISION NOT NULL,
    "quantityUnit" TEXT NOT NULL,
    "countryOfOrigin" TEXT NOT NULL,
    "installationId" TEXT,
    "actualEmissions" DOUBLE PRECISION,
    "defaultEmissions" DOUBLE PRECISION NOT NULL,
    "totalEmissions" DOUBLE PRECISION NOT NULL,
    "certificateCost" DOUBLE PRECISION,
    metadata JSONB,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL
);

-- CbamQuarterlyReport table
CREATE TABLE "cbam_quarterly_reports" (
    id TEXT PRIMARY KEY,
    "companyId" TEXT NOT NULL REFERENCES "Company"(id),
    year INTEGER NOT NULL,
    quarter INTEGER NOT NULL,
    status TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submissionId" TEXT,
    "totalEmissions" DOUBLE PRECISION NOT NULL,
    "certificatesRequired" INTEGER NOT NULL,
    "certificatesPurchased" INTEGER,
    "reportData" JSONB NOT NULL,
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP(3) NOT NULL,
    
    UNIQUE ("companyId", year, quarter)
);

-- Indexes
CREATE INDEX "cbam_goods_companyId_idx" ON "cbam_goods"("companyId");
CREATE INDEX "cbam_goods_sector_idx" ON "cbam_goods"("sector");
CREATE INDEX "cbam_goods_cnCode_idx" ON "cbam_goods"("cnCode");

CREATE INDEX "import_declarations_companyId_idx" ON "import_declarations"("companyId");
CREATE INDEX "import_declarations_importDate_idx" ON "import_declarations"("importDate");
CREATE INDEX "import_declarations_goodsId_idx" ON "import_declarations"("goodsId");

CREATE INDEX "cbam_quarterly_reports_companyId_idx" ON "cbam_quarterly_reports"("companyId");
CREATE INDEX "cbam_quarterly_reports_status_idx" ON "cbam_quarterly_reports"("status");
```

## Seed Data (Optional)

To populate initial CBAM goods data, create a seed script:

```typescript
// prisma/seed-cbam.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cbamGoods = [
    {
      cnCode: '2523',
      goodsName: 'Cement clinker',
      sector: 'CEMENT',
      defaultValue: 0.94,
      unit: 'tCO2e/tonne',
    },
    {
      cnCode: '72',
      goodsName: 'Iron and steel products',
      sector: 'IRON_STEEL',
      defaultValue: 1.85,
      unit: 'tCO2e/tonne',
    },
    {
      cnCode: '76',
      goodsName: 'Aluminium products',
      sector: 'ALUMINIUM',
      defaultValue: 8.5,
      unit: 'tCO2e/tonne',
    },
    // Add more as needed
  ];

  for (const good of cbamGoods) {
    await prisma.cbamGoods.create({
      data: {
        ...good,
        companyId: 'SYSTEM', // System-wide defaults
      },
    });
  }

  console.log('CBAM goods seeded successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run the seed:
```bash
npx ts-node prisma/seed-cbam.ts
```

## Verification

After migration, verify the tables were created:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%cbam%';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename LIKE '%cbam%';
```

## Troubleshooting

### Error: "Cannot find module '@prisma/client'"
**Solution**: Run `npx prisma generate`

### Error: "Table doesn't exist"
**Solution**: Run `npx prisma migrate deploy`

### Error: "Prisma schema has changed"
**Solution**: Run `npx prisma generate` again

## Rollback

If you need to rollback the migration:

```bash
npx prisma migrate resolve --rolled-back <migration-name>
```

Or manually drop the tables:

```sql
DROP TABLE IF EXISTS "cbam_quarterly_reports" CASCADE;
DROP TABLE IF EXISTS "import_declarations" CASCADE;
DROP TABLE IF EXISTS "cbam_goods" CASCADE;
```

## Post-Migration Checklist

- [ ] Prisma client generated successfully
- [ ] Database tables created
- [ ] Indexes created
- [ ] Company relations updated
- [ ] Application builds without errors
- [ ] Unit tests pass
- [ ] API endpoints accessible
- [ ] Sample data seeded (optional)

## Next Steps

1. Build the application:
   ```bash
   npm run build
   ```

2. Start development server:
   ```bash
   npm run start:dev
   ```

3. Test the CBAM endpoints:
   ```bash
   curl http://localhost:3000/api/v1/cbam/sectors
   ```

4. Review the API documentation in `src/cbam/README.md`

---

For questions or issues, refer to the implementation summary or contact the development team.
