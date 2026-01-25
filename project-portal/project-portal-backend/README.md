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

