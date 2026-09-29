# Agent Service: Standalone Agentic AI Service for CarbonScribe

The **Agent Service** is CarbonScribe's agentic AI service orchestrating domain-specific agents:
- **Discovery Agent**: Identifies and recommends carbon credit options based on company requirements.
- **PDD Draft Agent**: Walks project submissions, matches them against eligible methodologies, and drafts Project Design Document (PDD) sections.
- **Compliance Report Agent**: Generates structured compliance and ESG reports across frameworks (CSRD, GHG Protocol, SBTi, etc.).
- **Alert Triage Agent**: Evaluates monitoring alerts and determines escalation verdicts for human reviewer sign-off.

---

## 🚀 Local Development

### Prerequisites
- Node.js (v20+)
- PostgreSQL (for audit log and approval outbox)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

3. Configure upstream backends or enable Mock Mode:
   - To develop locally without a running `project-portal-backend` instance, enable Mock / Fixture Mode:
     ```bash
     AGENT_SERVICE_MOCK_PROJECT_PORTAL=true
     ```
   - When enabled, `projectPortalClient` methods (`getMethodologies`, `confirmAlert`) resolve directly from static fixture data in `src/clients/project-portal.client.fixtures.ts` instead of issuing outbound HTTP requests.

4. Run the service:
   ```bash
   # Development mode with hot reloading
   npm run start:dev

   # Build TypeScript
   npm run build

   # Start production bundle
   npm start
   ```

5. Run tests and linting:
   ```bash
   npm test
   npm run lint
   ```

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP server port | `4500` |
| `NODE_ENV` | Runtime environment (`development`, `production`, `test`) | `development` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | Required for LLM calls |
| `AGENT_MODEL` | Claude model identifier | `claude-opus-5` |
| `AGENT_SERVICE_JWT_SECRET` | Secret used to sign outbound service tokens | - |
| `CORPORATE_PLATFORM_JWT_SECRET`| Inbound JWT secret for corporate-platform calls | - |
| `PROJECT_PORTAL_JWT_SECRET` | Inbound JWT secret for project-portal calls | - |
| `CORPORATE_PLATFORM_BASE_URL` | Base URL for corporate-platform backend | `http://localhost:3000` |
| `PROJECT_PORTAL_BASE_URL` | Base URL for project-portal backend | `http://localhost:8080` |
| `AGENT_SERVICE_MOCK_PROJECT_PORTAL` | When `true`, returns fixture data for project-portal without HTTP calls | `false` |
| `AGENT_AUDIT_DATABASE_URL` | PostgreSQL connection string for audit log & approvals | `postgres://postgres:postgres@localhost:5432/agent_service` |
| `APPROVAL_REVIEWER_SERVICES` | Comma-separated list of services permitted to review approvals | - |

---

## 📁 Folder Structure

```
agent-service/
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
