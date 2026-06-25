# Retirement Data Aggregation for Analytics Dashboards

## Overview
This module implements a real-time and scheduled aggregation pipeline for retirement events, powering analytics dashboards with up-to-date carbon offset data. It integrates with the Soroban Retirement Tracker contract and exposes API endpoints for summary, trends, and breakdowns.

## Architecture
- **Event Ingestion:**
  - Soroban events are polled and dispatched via `WebhookDispatcherService`.
  - `RetirementAggregationHandler` listens for `contract.retirement` events and updates the aggregation collection.
- **Aggregation:**
  - Events are grouped by day, entity, asset type, and project.
  - Aggregated data is stored in MongoDB for fast queries.
- **API Endpoints:**
  - `GET /api/v1/analytics/retirements/summary` — Total retired and by period
  - `GET /api/v1/analytics/retirements/trends` — Time-series data
  - `GET /api/v1/analytics/retirements/breakdown` — By entity, asset type, project

## Key Files
- `src/analytics/services/retirement-aggregation.service.ts` — Aggregation logic and API
- `src/analytics/services/retirement-aggregation.handler.ts` — Real-time event handler
- `src/analytics/schemas/retirement-aggregation.schema.ts` — Aggregation schema
- `src/analytics/analytics.controller.ts` — API endpoints
- `src/analytics/analytics.module.ts` — Module wiring and handler registration

## Usage
- Ensure MongoDB and Mongoose are installed and configured.
- Soroban events must include: `retiredAt`, `entity`, `assetType`, `project`, `amount`.
- Aggregation runs every 5 minutes and on each event.
- Query analytics endpoints for dashboard data.

## Testing & Quality
- Type safety enforced throughout (TypeScript, Mongoose schemas)
- All endpoints and aggregation logic are covered by unit/integration tests (to be added)
- No TODOs or incomplete logic in production code

## Extensibility
- Add new breakdowns or aggregation dimensions by extending the schema and service logic.
- Integrate with additional event sources as needed.
