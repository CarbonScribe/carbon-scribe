# CORSIA Module API

This module provides CORSIA compliance workflows for emissions monitoring, offset requirement calculation, and annual reporting.

## Endpoints

- `POST /api/v1/corsia/flights/record` - Record a flight and calculate CO2 emissions.
- `POST /api/v1/corsia/flights/batch` - Batch-record flights.
- `GET /api/v1/corsia/flights` - List flight records (optional `year` filter).
- `GET /api/v1/corsia/emissions/year/:year` - Get annual emissions summary.
- `GET /api/v1/corsia/offset-requirement/:year` - Calculate annual offset requirement.
- `GET /api/v1/corsia/compliance/:year` - Retrieve annual compliance status.
- `POST /api/v1/corsia/credits/validate` - Validate retired credits against CORSIA eligibility criteria.
- `GET /api/v1/corsia/credits/eligible` - List validated eligible credits.
- `POST /api/v1/corsia/reports/generate` - Generate annual CORSIA emissions report payload.
- `GET /api/v1/corsia/eligible-fuels` - List supported CORSIA-eligible fuel pathways.

## Notes

- Baseline year is configured as 2019 and falls back to first available annual emissions year if unavailable.
- SAF adjustments are applied by lifecycle reduction factors in `EligibleFuelsService`.
- Offset requirements use phase-based sectoral and individual growth shares.
