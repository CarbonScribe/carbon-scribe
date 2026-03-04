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
