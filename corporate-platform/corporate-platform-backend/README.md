# CarbonScribe Corporate Platform Backend

![NestJS](https://img.shields.io/badge/NestJS-10.0-red)
![Prisma](https://img.shields.io/badge/Prisma-7.4-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/license-AGPL--3.0-green)

The **Corporate Platform Backend** is a NestJS service that powers the enterprise carbon credit retirement system for CarbonScribe. It provides instant retirement capabilities, compliance reporting, marketplace functionality, and blockchain integration for corporate carbon management.

This service is **Layer 4** of the CarbonScribe 7-layer architecture, enabling corporations to purchase, retire, and report carbon credits with full transparency and on-chain verification.

---

## 📋 Table of Contents
* [Overview](#-overview)
* [Architecture](#️-architecture)
* [Tech Stack](#tech-stack)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Configuration](#configuration)
* [Database Setup](#database-setup)
* [Running the Service](#running-the-service)
* [API Documentation](#api-documentation)
* [Testing](#testing)
* [Project Structure](#project-structure)
* [Contributing](#contributing)
* [Troubleshooting](#troubleshooting)
* [License](#license)

---

## 🌟 Overview
The Corporate Platform Backend handles all server-side operations for corporate carbon credit management:

* **Instant Credit Retirement:** One-click retirement with on-chain verification.
* **Certificate Generation:** PDF certificates with IPFS anchoring.
* **Compliance Reporting:** Automated ESG reports (GHG Protocol, CSRD, SBTi).
* **Marketplace Operations:** Dutch auctions, credit discovery, and portfolio management.
* **Blockchain Integration:** Stellar/Soroban smart contract interactions.
* **Real-time Analytics:** Impact dashboards and carbon accounting.

---

## 🏗️ Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                   Corporate Platform Backend                 │
├─────────────────────────────────────────────────────────────┤
│                      Presentation Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Controllers│  │   Webhooks  │  │   GraphQL Resolvers │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                       Service Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Retirement │  │ Compliance  │  │    Marketplace      │  │
│  │   Service   │  │   Service   │  │      Service        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Analytics  │  │ Certificate │  │    Validation       │  │
│  │   Service   │  │   Service   │  │      Service        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                    Integration Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Stellar   │  │    IPFS     │  │      Redis          │  │
│  │   Service   │  │   Service   │  │      Cache          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                      Data Layer                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PostgreSQL + Prisma ORM                   │  │
│  │         Companies │ Credits │ Retirements │ Certs      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```
---

## 💻 Tech Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | NestJS 10.x | Node.js server framework |
| **Language** | TypeScript 5.x | Type-safe JavaScript |
| **Database** | PostgreSQL 16+ | Primary data store |
| **ORM** | Prisma 7.4+ | Type-safe database access |
| **Cache** | Redis 7+ | Real-time data & sessions |
| **Blockchain** | Stellar SDK + Soroban | On-chain operations |
| **Storage** | IPFS (Pinata) | Certificate permanence |
| **PDF Generation** | PDFKit | Retirement certificates |
| **Validation** | class-validator + class-transformer | DTO validation |
| **Testing** | Jest + Supertest | Unit & E2E tests |
| **Documentation** | Swagger/OpenAPI | API documentation |

---

## 📋 Prerequisites

Before you begin, ensure you have installed:
* **Node.js**: 20.x or higher
* **npm**: 10.x or higher (or yarn/pnpm)
* **PostgreSQL**: 16.x or higher
* **Redis**: 7.x or higher (for caching)
* **Git**: for version control
* **Stellar Testnet Account**: (for development)

---

## 🔧 Installation

### 1. Clone the Repository
```bash
  # Clone your fork
  git clone https://github.com/YOUR_USERNAME/carbon-scribe.git
  cd corporate-platform/corporate-platform-backend
  npm install
  npm install -g prisma
  # or use npx
  npx prisma --version
  cp .env.example .env

  # Generate Prisma Client
  npx prisma generate

  # Run initial migration
  npx prisma migrate dev --name init
```

## Kafka Setup (Required For Event Bus)

This service uses Kafka for the event bus and topic bootstrap on startup.
If Kafka is not reachable from `KAFKA_BROKERS`, event-driven features (producer,
consumer, DLQ, topic management) will not work.

### Start Kafka Locally (Docker)

If you already have Zookeeper running on `localhost:2181`, start Kafka with:

```bash
docker run -d --name kafka \
  -p 9092:9092 \
  -e KAFKA_BROKER_ID=1 \
  -e KAFKA_ZOOKEEPER_CONNECT=host.docker.internal:2181 \
  -e KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092 \
  -e KAFKA_LISTENERS=PLAINTEXT://0.0.0.0:9092 \
  -e KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 \
  confluentinc/cp-kafka:7.5.0
```

On Linux, if `host.docker.internal` is not available, use your host IP or run
Kafka and Zookeeper in the same Docker network.

### Verify Kafka Connectivity

```bash
nc -zv localhost 9092
```

On successful backend startup, you should see logs similar to:

- `Kafka connected successfully.`
- `Creating ... Kafka topics...`
- `Topics created successfully.`

## Environment Configuration

Copy `.env.example` to `.env` and set values for your local machine:

```bash
cp .env.example .env
```

Minimum properties contributors should set for reliable local startup:

```env
NODE_ENV=development
PORT=4000
API_PREFIX=api/v1

DATABASE_URL=postgresql://username:password@localhost:5432/db

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=corporate-platform-backend
KAFKA_SSL_ENABLED=false
KAFKA_RETRY_INITIAL=300
KAFKA_RETRY_MAX=5

JWT_SECRET=replace-with-a-strong-secret
JWT_EXPIRY=15m
```

`PORT=4000` is recommended locally to avoid conflicts with other services on `3000`.

## 📁 Project Structure
```
corporate-platform-backend/
├── src/
│   ├── retirement/                 # Retirement module
│   │   ├── dto/                    # Data transfer objects
│   │   │   ├── retire-credits.dto.ts
│   │   │   └── retirement-query.dto.ts
│   │   ├── services/               
│   │   │   ├── instant-retirement.service.ts
│   │   │   ├── validation.service.ts
│   │   │   ├── certificate.service.ts
│   │   │   └── history.service.ts
│   │   ├── retirement.controller.ts
│   │   ├── retirement.service.ts
│   │   └── retirement.module.ts
│   ├── compliance/                  # Compliance module
│   │   ├── compliance.controller.ts
│   │   ├── reporting-engine.service.ts
│   │   └── compliance.module.ts
│   ├── marketplace/                 # Marketplace module
│   │   ├── marketplace.controller.ts
│   │   ├── discovery-engine.service.ts
│   │   └── marketplace.module.ts
│   ├── stellar/                     # Blockchain integration
│   │   ├── stellar.service.ts
│   │   ├── soroban.service.ts
│   │   └── stellar.module.ts
│   ├── webhooks/                     # Webhook handlers
│   │   ├── webhooks.controller.ts
│   │   ├── stellar-webhook.service.ts
│   │   └── webhooks.module.ts
│   ├── analytics/                     # Analytics module
│   │   ├── analytics.controller.ts
│   │   ├── impact-dashboard.service.ts
│   │   └── analytics.module.ts
│   ├── shared/                        # Shared resources
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── prisma.service.ts      # Prisma client service
│   │   ├── cache/
│   │   │   └── redis.service.ts       # Redis cache
│   │   ├── ipfs/
│   │   │   └── ipfs.service.ts        # IPFS storage
│   │   ├── guards/                     # Auth guards
│   │   └── interceptors/               # HTTP interceptors
│   ├── app.module.ts
│   ├── app.controller.ts
│   └── main.ts
├── prisma/
│   ├── schema.prisma                   # Database schema
│   └── migrations/                      # Migration files
├── test/
│   ├── retirement.e2e-spec.ts
│   └── compliance.e2e-spec.ts
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── nest-cli.json
├── package.json
├── prisma.config.js                     # Prisma 7+ config
├── tsconfig.json
└── README.md
```
---
CarbonScribe Corporate Platform Backend - Making corporate carbon retirement instant, transparent, and verifiable. 🌍

## API Key Authentication

The backend includes an API key management module at `src/api-key/` for machine-to-machine access.

Management endpoints (JWT admin required):

- `POST /api/v1/api-keys` - Create a key (returns the secret once)
- `GET /api/v1/api-keys` - List company API keys
- `GET /api/v1/api-keys/:id` - Get API key details (no secret)
- `PATCH /api/v1/api-keys/:id` - Update name/permissions/limits/expiry
- `DELETE /api/v1/api-keys/:id` - Revoke a key
- `POST /api/v1/api-keys/:id/rotate` - Rotate and return a new secret once
- `GET /api/v1/api-keys/:id/usage` - Usage summary (request count, last used)

For API key protected endpoints, send the key in either:

- `x-api-key: sk_live_...`
- `Authorization: Bearer sk_live_...`

The `ApiKeyGuard` enforces key validity, expiry, optional IP whitelist, permissions metadata, and per-key rate limiting headers (`X-RateLimit-*`).

Designated API key protected endpoints for programmatic reporting:

- `GET /api/v1/integrations/retirement-analytics/purpose-breakdown`
- `GET /api/v1/integrations/retirement-analytics/trends`
- `GET /api/v1/integrations/retirement-analytics/forecast`
- `GET /api/v1/integrations/retirement-analytics/impact`
- `GET /api/v1/integrations/retirement-analytics/progress`
- `GET /api/v1/integrations/retirement-analytics/summary`

These endpoints require the API key permission `analytics:read` and automatically scope analytics queries to the key's `companyId`.

## Team Management Core Service

The backend now includes a dedicated Team Management module at `src/team-management/` with multi-tenant RBAC-aware operations for members, roles, permissions, and invitations.

Core endpoints:

- `GET /api/v1/team/members`
- `GET /api/v1/team/members/:id`
- `POST /api/v1/team/members`
- `PUT /api/v1/team/members/:id`
- `DELETE /api/v1/team/members/:id`
- `POST /api/v1/team/members/:id/reactivate`
- `POST /api/v1/team/members/:id/role`
- `GET /api/v1/team/roles`
- `POST /api/v1/team/roles`
- `PUT /api/v1/team/roles/:id`
- `DELETE /api/v1/team/roles/:id`
- `GET /api/v1/team/permissions`
- `GET /api/v1/team/permissions/my`
- `POST /api/v1/team/invitations`
- `GET /api/v1/team/invitations`
- `POST /api/v1/team/invitations/:token/accept`
- `POST /api/v1/team/invitations/:id/resend`
- `DELETE /api/v1/team/invitations/:id`

Implementation notes:

- Invitation tokens expire after 7 days.
- System roles (`ADMIN`, `MANAGER`, `ANALYST`, `VIEWER`) are provisioned per company automatically.
- Audit trail events are recorded in `AuditLog` for member, role, and invitation changes.
- Permission checks are integrated with the existing `JwtAuthGuard` + `PermissionsGuard` flow through `RbacService`.

## Credit Module: Database Migration

The project includes a new `Credit` and extended `Project` models in `prisma/schema.prisma` used by the `src/credit` module.

After pulling these changes, run the Prisma migration and generator to update your database and client:

```bash
# generate client
npx prisma generate

# create and apply migration (interactive)
npx prisma migrate dev --name add_credit_models
```

If you manage migrations centrally, prefer creating the migration in your CI or local environment and reviewing it before applying in production.
