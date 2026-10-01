# CarbonScribe Agent Service

Standalone agentic AI microservice for the CarbonScribe platform. Powers automated carbon credit discovery, PDD drafting, compliance report generation, and anomaly alert triage by coordinating LLM capabilities with upstream platform APIs.

---

## 📋 Table of Contents

- [Overview](#-overview)
- [API Documentation & OpenAPI Spec](#-api-documentation--openapi-spec)
- [Authentication](#-authentication)
- [Route Catalog](#-route-catalog)
- [Client Integration (Go & NestJS)](#-client-integration-go--nestjs)
- [Environment Configuration](#-environment-configuration)
- [Development & Testing](#-development--testing)
  - [Mock Mode for Local Development](#-mock-mode-for-local-development)
  - [Load Testing](#-load-testing)
- [Folder Structure](#-folder-structure)
- [License](#-license)

---

## 🌟 Overview

The **Agent Service** provides dedicated agentic AI workflows for the CarbonScribe ecosystem. Rather than executing direct financial or on-chain transactions, agents produce draft recommendations and reports backed by grounded citations and data evidence:

- **Credit Discovery Agent (`/agents/discovery/run`):** Matches corporate buyer criteria (budget, sector, co-benefit priorities, compliance framework) against available carbon marketplace credits.
- **PDD Drafting Agent (`/agents/pdd-draft/run`):** Matches project developer submissions to eligible methodology standards (e.g. VM0042) and drafts PDD sections while highlighting missing documentation.
- **Compliance Report Agent (`/agents/compliance-report/run`):** Assembles corporate retirement evidence and drafts narrative sections for regulatory frameworks (CSRD, CBAM, CORSIA, SBTi, GHG Protocol). All runs produce a `needs-approval` outcome.
- **Alert Triage Agent (`/agents/alert-triage/run`):** Correlates satellite NDVI imagery, IoT sensors, and weather context to classify deforestation/anomaly alerts. Confirmed escalations require human review before firing downstream notifications.
- **Human Approval Queue (`/approvals`):** Durable PostgreSQL queue and transactional outbox for reviewer decisions (`POST /approvals/:requestId/approve` or `reject`).

---

## 📐 API Documentation & OpenAPI Spec

An OpenAPI 3.0.3 specification is maintained as code and served directly by the service:

| Format | URL Endpoint | Checked-in File |
| :--- | :--- | :--- |
| **JSON** | [`/openapi.json`](http://localhost:4500/openapi.json) | [`openapi.json`](./openapi.json) |
| **YAML** | [`/openapi.yaml`](http://localhost:4500/openapi.yaml) | [`openapi.yaml`](./openapi.yaml) |

### Generating / Updating the Spec

The OpenAPI contract is defined in `src/openapi/openapi.document.ts`. To regenerate the checked-in `openapi.json` and `openapi.yaml` artifacts:

```bash
npm run generate:openapi
```

Automated test suites (`src/openapi/openapi.spec.test.ts`) verify that the checked-in files never drift from the in-code schema definition.

---

## 🔐 Authentication

All routes under `/agents/*` and `/approvals/*` enforce internal service-to-service authentication via JWT (`requireInternalAuth` middleware):

```http
Authorization: Bearer <signed-jwt-token>
```

- **Algorithm:** HS256
- **Signing Secrets:** Configured per calling service issuer via `CORPORATE_PLATFORM_JWT_SECRET` and `PROJECT_PORTAL_JWT_SECRET`.
- **Identity Propagation:** The verified issuer is extracted from the token's `iss` claim and set as `req.callingService` for audit logging and role verification.
- **Public Routes:** `/health/liveness`, `/health/readiness`, `/openapi.json`, and `/openapi.yaml` are unauthenticated for orchestrators and client tooling.

---

## 🛣️ Route Catalog

### Health Probes (Unauthenticated)

| Method | Route | Description | Response Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/health/liveness` | Express process liveness probe | `200` |
| `GET` | `/health/readiness` | Parallel reachability check for Anthropic, Corporate Platform, and Project Portal | `200`, `503` |

### Agent Execution Routes (`Authorization: Bearer <token>`)

| Method | Route | Agent Name | Description | Response Codes |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/agents/discovery/run` | `discovery` | Market credit discovery & shortlisting | `200`, `401`, `502` |
| `POST` | `/agents/pdd-draft/run` | `pdd-draft` | Project methodology matching & PDD drafting | `200`, `401`, `502` |
| `POST` | `/agents/compliance-report/run` | `compliance-report` | Regulatory compliance report narrative generation | `200`, `401`, `502` |
| `POST` | `/agents/alert-triage/run` | `alert-triage` | Satellite & sensor deforestation alert classification | `200`, `401`, `502` |

### Approvals Queue (`Authorization: Bearer <token>` with `APPROVAL_REVIEWER_SERVICES`)

| Method | Route | Description | Response Codes |
| :--- | :--- | :--- | :--- |
| `GET` | `/approvals` | List pending approval requests | `200`, `401`, `403` |
| `POST` | `/approvals/:requestId/approve` | Approve a pending agent outcome & queue outbox action | `200`, `400`, `401`, `403`, `404`, `409` |
| `POST` | `/approvals/:requestId/reject` | Reject a pending agent outcome | `200`, `400`, `401`, `403`, `404`, `409` |

### Contract Discovery (Unauthenticated)

| Method | Route | Description | Content-Type |
| :--- | :--- | :--- | :--- |
| `GET` | `/openapi.json` | Complete OpenAPI 3.0.3 spec | `application/json` |
| `GET` | `/openapi.yaml` | Complete OpenAPI 3.0.3 spec | `text/yaml; charset=utf-8` |

---

## 🔗 Client Integration (Go & NestJS)

Consuming services can generate typed clients directly against `agent-service/openapi.yaml` or `http://localhost:4500/openapi.json`:

### 1. Go (`project-portal-backend`)

Using `oapi-codegen`:

```bash
go run github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen \
  --config=oapi-codegen.yaml \
  ../../agent-service/openapi.yaml
```

### 2. NestJS / TypeScript (`corporate-platform-backend`)

Using OpenAPI Generator or `openapi-typescript`:

```bash
npx openapi-typescript ../../agent-service/openapi.yaml -o src/agents/agent-service.types.ts
```

---

## ⚙️ Environment Configuration

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP server port | `4500` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Required for LLM calls |
| `AGENT_MODEL` | Claude model identifier | `claude-opus-5` |
| `AGENT_SERVICE_JWT_SECRET` | Secret used to sign outbound service tokens | - |
| `CORPORATE_PLATFORM_JWT_SECRET` | Inbound JWT secret for corporate-platform calls | - |
| `PROJECT_PORTAL_JWT_SECRET` | Inbound JWT secret for project-portal calls | - |
| `APPROVAL_REVIEWER_SERVICES` | Comma-separated list of services permitted to review approvals | `""` |
| `APPROVAL_OUTBOX_POLL_INTERVAL_MS` | Outbox polling interval in milliseconds | `3000` |
| `APPROVAL_OUTBOX_BATCH_SIZE` | Outbox batch processing size | `20` |
| `APPROVAL_OUTBOX_MAX_ATTEMPTS` | Outbox maximum delivery retry attempts | `5` |
| `APPROVAL_OUTBOX_LOCK_TIMEOUT_MS` | Outbox row lock timeout in milliseconds | `60000` |
| `APPROVAL_OUTBOX_RETRY_BASE_MS` | Outbox exponential backoff base delay in ms | `1000` |
| `APPROVAL_OUTBOX_RETRY_MAX_MS` | Outbox exponential backoff max delay in ms | `60000` |
| `CORPORATE_PLATFORM_BASE_URL` | Base URL for corporate-platform backend | `http://localhost:3000` |
| `PROJECT_PORTAL_BASE_URL` | Base URL for project-portal backend | `http://localhost:8080` |
| `AGENT_SERVICE_MOCK_PROJECT_PORTAL` | When `true`, returns fixture data for project-portal without HTTP calls | `false` |
| `AGENT_AUDIT_DATABASE_URL` | PostgreSQL connection string for audit log & approvals | `postgres://postgres:postgres@localhost:5432/agent_service` |

---

## 🛠️ Development & Testing

### Setup & Run

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Run development mode with hot reloading
npm run start:dev

# Run unit and integration tests
npm test

# Build TypeScript to dist/
npm run build

# Run linter
npm run lint

# Generate OpenAPI artifacts
npm run generate:openapi
```

### 🧪 Mock Mode for Local Development

To develop locally or test agent workflows (such as PDD drafting or alert triage) without requiring a running `project-portal-backend` instance, enable Mock / Fixture Mode:

```bash
AGENT_SERVICE_MOCK_PROJECT_PORTAL=true
```

When enabled, `projectPortalClient` methods (`getMethodologies`, `confirmAlert`) resolve directly from static fixture data in `src/clients/project-portal.client.fixtures.ts` instead of issuing outbound HTTP requests.

### 📊 Load Testing

Run the automated concurrency and load testing suite:

```bash
npm run loadtest
```

For more details on load test benchmarks and options, see [LOAD_TESTING.md](./LOAD_TESTING.md).

---

## 📁 Folder Structure

```
agent-service/
├── loadtest/            # Concurrency & load testing suite
├── migrations/          # PostgreSQL database migrations
├── src/
│   ├── agents/          # Domain agent implementations (discovery, pdd-draft, etc.)
│   ├── clients/         # Upstream HTTP clients & fixtures (corporate-platform, project-portal)
│   ├── config/          # Environment configuration & validation
│   ├── health/          # Health and readiness probe endpoints
│   ├── llm/             # Anthropic client and error handling
│   ├── openapi/         # OpenAPI specification and controllers
│   ├── routes/          # Express route definitions
│   └── shared/          # Shared auth, guardrails, outbox, and audit logging
└── test/                # Integration and end-to-end tests
```

---

## 📄 License

UNLICENSED (Internal CarbonScribe Service)
