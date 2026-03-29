# Project Portal Backend - CarbonScribe

## 🌱 Overview
Project Portal Backend is the central orchestration service for CarbonScribe, enabling regenerative agriculture projects in developing nations to issue, manage, and tokenize carbon credits as Stellar Assets. This Go-based backend serves as the operational hub connecting project developers with the blockchain-based carbon credit ecosystem.

## The CarbonScribe Vision
CarbonScribe transforms physical ecosystem services into programmable, trustless financial assets with real-time environmental telemetry. We're building the Internet of Carbon - a digital public utility that bridges environmental stewardship with blockchain transparency.

## 🏗️ Architecture
This service operates within CarbonScribe's 7-Layer Architecture as Layer 3: Project Developer Portal.

```
project-portal-backend/
├── api/
│   ├── v1/
│   └── monitoring.go
├── cmd/
│   ├── api/
│   │   └── main.go
│   └── workers/
│       ├── alert_worker.go
│       ├── minting_worker.go
│       ├── payout_worker.go
│       ├── price_update_worker.go
│       ├── retention_worker.go
│       └── satellite_worker.go
├── internal/
│   ├── auth/
│   │   ├── handler.go
│   │   ├── jwt.go
│   │   ├── middleware.go
│   │   ├── models.go
│   │   ├── repository.go
│   │   ├── routes.go
│   │   ├── service.go
│   │   └── submission.go
│   ├── collaboration/
│   │   ├── handler.go
│   │   ├── models.go
│   │   ├── repository.go
│   │   ├── routes.go
│   │   └── service.go
│   ├── compliance/
│   │   ├── audit/
│   │   │   ├── immutable_log.go
│   │   │   ├── logger.go
│   │   │   ├── middleware.go
│   │   │   └── query.go
│   │   ├── privacy/
│   │   │   ├── consent.go
│   │   │   └── preferences.go
│   │   └── requests/
│   │       ├── deleter.go
│   │       ├── exporter.go
│   │       └── processor.go
│   ├── config/
│   │   └── config.go
│   ├── database/
│   │   └── migrations/
│   │       └── 008_reporting_tables.sql
│   ├── document/
│   │   ├── ipfs_uploader.go
│   │   └── pdf_generator.go
│   ├── financing/
│   │   ├── calculation/
│   │   │   ├── engine.go
│   │   │   ├── methodologies.go
│   │   │   └── validator.go
│   │   ├── sales/
│   │   │   ├── auctions.go
│   │   │   └── tokenization/
│   │   │       ├── forward_sale.go
│   │   │       ├── handler.go
│   │   │       ├── models.go
│   │   │       ├── monitor.go
│   │   │       ├── repository.go
│   │   │       ├── service.go
│   │   │       ├── stellar_client.go
│   │   │       ├── tokenization.go
│   │   │       └── workflow.go
│   │   └── tokenization/
│   │       ├── forward_sale.go
│   │       ├── handler.go
│   │       ├── models.go
│   │       ├── repository.go
│   │       ├── service.go
│   │       └── tokenization.go
│   ├── geospatial/
│   │   ├── geometry/
│   │   │   ├── calculator.go
│   │   │   ├── processor.go
│   │   │   └── transformer.go
│   │   └── queries/
│   │       ├── intersection.go
│   │       ├── models.go
│   │       ├── repository.go
│   │       └── service.go
│   ├── integration/
│   │   ├── handler.go
│   │   ├── models.go
│   │   ├── repository.go
│   │   ├── routes.go
│   │   └── service.go
│   ├── middleware/
│   │   └── auth.go
│   ├── monitoring/
│   │   ├── alerts/
│   │   │   ├── engine.go
│   │   │   └── notifications.go
│   │   ├── analytics/
│   │   │   ├── performance.go
│   │   │   └── trends.go
│   │   ├── functions/
│   │   │   └── handler.go
│   │   ├── ingestion/
│   │   │   └── webhook.go
│   │   └── processing/
│   │       ├── biomass_estimator.go
│   │       └── ndvi_calculator.go
│   ├── notifications/
│   │   ├── channels/
│   │   │   ├── email.go
│   │   │   ├── sms.go
│   │   │   └── websocket.go
│   │   ├── rules/
│   │   │   ├── engine.go
│   │   │   ├── evaluator.go
│   │   │   └── scheduler.go
│   │   ├── templates/
│   │   │   └── managers.go
│   │   ├── websocket/
│   │   │   └── lambda_handlers/
│   │   │       ├── connect.go
│   │   │       ├── default.go
│   │   │       ├── disconnect.go
│   │   │       ├── manager.go
│   │   │       └── router.go
│   │   ├── handler.go
│   │   ├── models.go
│   │   ├── repository.go
│   │   └── service.go
│   ├── payments/
│   │   ├── distribution.go
│   │   ├── processors.go
│   │   └── stellar_payments.go
│   ├── project/
│   │   ├── methodology.go
│   │   ├── onboarding.go
│   │   └── verification.go
│   ├── reports/
│   │   ├── benchmarks/
│   │   │   └── comparator.go
│   │   ├── dashboard/
│   │   │   └── aggregator.go
│   │   ├── export/
│   │   ├── scheduler/
│   │   │   └── manager.go
│   │   ├── handler.go
│   │   ├── models.go
│   │   ├── repository.go
│   │   └── service.go
│   └── retention/
│       ├── handler.go
│       ├── models.go
│       ├── policy_manager.go
│       ├── repository.go
│       ├── scheduler.go
│       └── service.go
├── pkg/
│   ├── aws/
│   │   ├── apigateway.go
│   │   ├── dynamodb_client.go
│   │   ├── ses_client.go
│   │   └── sns_client.go
│   ├── events/
│   │   └── event_bridge.go
│   ├── geojson/
│   │   ├── parser.go
│   │   ├── validation.go
│   │   └── validator.go
│   ├── iot/
│   │   └── mqtt_client.go
│   ├── postgis/
│   │   ├── client.go
│   │   └── spatial_functions.go
│   ├── utils/
│   │   ├── jwt.go
│   │   └── password.go
│   └── websocket/
│       ├── auth.go
│       └── protocol.go
├── .env.example
├── .gitignore
├── Dockerfile
├── go.mod
├── go.sum
├── Makefile
└── README.md
```
---

## 🚀 Getting Started

### Prerequisites
- Go 1.21+
- PostgreSQL 15+
- Redis 7+
- Stellar Testnet/Soroban CLI
- AWS Account (for S3, SES, SNS)

### Installation
1. Clone and setup:
```bash
git clone https://github.com/your-account/carbon-scribe.git # forked from organisation
cd project-portal/project-portal-backend
cp .env.example .env
# Edit .env with your configuration
```

2. Install dependencies:
```bash
make deps
```

3. Run database migrations:
```bash
make migrate-up
```
4. Start development server:
```bash

```

### Configuration
Key environment variables:
```bash
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/carbonscribe

# Stellar
STELLAR_NETWORK=testnet
STELLAR_SECRET_KEY=your_secret

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET=carbon-documents
```

## Methodology NFT Registration Flow

Project onboarding now supports registration of project methodologies in the Methodology Library contract as NFTs.

Contract details:
- Contract ID: `CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP`
- Functionality: `mint_methodology`, `is_valid_methodology`

Flow:
1. Create a project with optional `methodology` payload.
2. Backend mints a methodology NFT for the project owner/developer.
3. Returned `methodology_token_id` and `methodology_contract_id` are linked on the project.
4. Registration is stored in `methodology_registrations`.
5. Credit minting validates the linked methodology token before proceeding.

New endpoints:
- `POST /api/v1/projects/:id/register-methodology`
- `GET /api/v1/projects/:id/methodology`
- `GET /api/v1/methodologies/:tokenId/validate`

Environment variables:
```bash
STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
METHODOLOGY_LIBRARY_CONTRACT_ID=CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP
METHODOLOGY_AUTHORITY_SECRET_KEY=your_whitelisted_methodology_authority_secret_key
METHODOLOGY_USE_MOCK=false
METHODOLOGY_MOCK_START_TOKEN=1000
```

The deployed contract only allows whitelisted authority accounts to mint methodologies, so live testnet registration requires a funded authority secret key already approved by the contract admin.

## Methodology Supply Cap Enforcement

Methodology cap enforcement is now integrated at mint time. Before any credit minting transaction is submitted, the backend validates methodology-level supply limits and records the mint attempt outcome for auditability.

Core capabilities:
- Methodology-wide max supply checks
- Optional per-project and per-vintage cap checks
- Minting attempt logging (approved/rejected with reason)
- Automatic cap bootstrap from Methodology Library metadata and IPFS-linked cap payloads
- Near-limit monitoring endpoints

Cap management and monitoring endpoints:
- `GET /api/v1/methodologies/:tokenId/cap`
- `POST /api/v1/methodologies/:tokenId/cap`
- `GET /api/v1/methodologies/:tokenId/supply`
- `GET /api/v1/methodologies/:tokenId/minting-history`
- `GET /api/v1/projects/:id/minting-validations`
- `GET /api/v1/methodologies/caps/near-limit`

Required/important environment variables for real on-chain behavior:
```bash
# Shared Stellar network config
STELLAR_RPC_URL=https://soroban-testnet.stellar.org:443
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Methodology Library contract cap loading
METHODOLOGY_LIBRARY_CONTRACT_ID=CDQXMVTNCAN4KKPFOAMAAKU4B7LNNQI7F6EX2XIGKVNPJPKGWGM35BTP
METHODOLOGY_QUERY_ADDRESS=G...
IPFS_GATEWAY_URL=https://ipfs.io/ipfs/
METHODOLOGY_CAP_USE_MOCK=false

# Carbon Asset minting contract
CARBON_ASSET_CONTRACT_ID=CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM
CARBON_ASSET_AUTHORITY_SECRET_KEY=S...
CARBON_ASSET_DEFAULT_PROJECT_OWNER=G...
CARBON_ASSET_USE_MOCK=false
```

For mainnet deployment, set `STELLAR_RPC_URL` and `STELLAR_NETWORK_PASSPHRASE` to public-network values and provide funded, whitelisted operational keys.

## Collaboration API Authentication Update

Collaboration write operations now enforce JWT authentication and derive actor identity from token context. This removes impersonation risk from client-provided identity fields and ensures audit/activity attribution is server-controlled.

### Protected Write Endpoints

All collaboration routes run behind auth middleware, and the following write operations require a valid `Authorization: Bearer <token>` header:

- `POST /api/v1/collaboration/comments`
- `POST /api/v1/collaboration/tasks`
- `POST /api/v1/collaboration/resources`
- `POST /api/v1/collaboration/projects/:id/invite`
- `PATCH /api/v1/collaboration/tasks/:id`
- `DELETE /api/v1/collaboration/projects/:id/members/:userId`

Anonymous requests to protected write endpoints return `401 Unauthorized`.

### Request Body Contract Changes

Client-provided identity fields are no longer accepted for collaboration creates:

- Comments: removed `user_id`
- Tasks: removed `created_by`
- Resources: removed `uploaded_by`
- Project invite: `invited_by` is derived from JWT context (not request body)

Updated examples:

```json
{
	"project_id": "project-123",
	"content": "Please review the updated monitoring plan"
}
```

```json
{
	"project_id": "project-123",
	"title": "Collect baseline satellite data",
	"description": "Run the ingestion workflow for Q2",
	"priority": "high"
}
```

```json
{
	"project_id": "project-123",
	"type": "document",
	"name": "Monitoring Framework v2",
	"url": "https://example.com/framework-v2.pdf"
}
```

```json
{
	"email": "new.collaborator@example.com",
	"role": "Contributor"
}
```

### Attribution and Auditing

Activity logs for collaboration writes now use the authenticated `user_id` from JWT claims. Any identity value supplied by clients is ignored.

