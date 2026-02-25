# Database Service Module

Prisma ORM with PostgreSQL: connection management, migrations, repository pattern, and transaction support.

## Setup

- **Connection:** Set `DATABASE_URL` (e.g. `postgresql://user:pass@localhost:5432/dbname`).
- **Migrations:** `npm run db:migrate` or `npx prisma migrate deploy`.
- **Seed:** `npm run db:seed` (after migrations).
- **Generate client:** `npx prisma generate` (runs on install/build).

## Components

- **PrismaService** – Prisma client lifecycle: connect with retry on init, disconnect on destroy. Connection pooling via `pg.Pool`.
- **Repositories** – Entity-specific data access (Company, User, Credit, Project, Portfolio, Retirement, Transaction, Compliance, Report, Activity, Cart). Inject e.g. `UserRepository`, `CreditRepository`.
- **UnitOfWorkService** – Run multi-step operations in a single transaction: `await this.unitOfWork.run(async (tx) => { ... })`. Rollback on throw.
- **DatabaseModule** – Global module; exports `PrismaService`, `UnitOfWorkService`, and all repositories.

## Multi-tenancy

Relevant entities are scoped by `companyId`. Use `listByCompanyId(companyId)` on repositories and always filter by `companyId` in custom queries.

## Graceful shutdown

`main.ts` calls `app.enableShutdownHooks()`. `PrismaService.onModuleDestroy()` disconnects the client so the process can exit without hanging connections.
