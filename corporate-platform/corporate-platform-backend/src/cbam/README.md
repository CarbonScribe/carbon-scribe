# CBAM Compliance Service Module

## Overview
The Carbon Border Adjustment Mechanism (CBAM) Compliance Service provides comprehensive emissions tracking, calculation, and reporting for EU importers. This service helps companies comply with EU CBAM regulations by managing embedded emissions calculations, certificate tracking, and quarterly reporting requirements.

## Features

### 1. Goods Classification
- Management of CBAM-eligible goods with Combined Nomenclature (CN) codes
- Support for all six CBAM sectors:
  - Cement
  - Iron & Steel
  - Aluminium
  - Fertilizers
  - Electricity
  - Hydrogen

### 2. Embedded Emissions Calculations
- Calculate embedded emissions using actual data (when available)
- Apply default emission factors based on CBAM methodology
- Country-specific adjustment factors
- Installation-specific tracking

### 3. Import Declaration Management
- Record import declarations with detailed emissions data
- Track country of origin and installation IDs
- Automatic certificate cost calculation

### 4. Quarterly Reporting
- Generate CBAM-compliant quarterly reports
- Automated deadline tracking and reminders
- Report submission workflow (DRAFT → SUBMITTED → ACCEPTED)

### 5. Certificate Tracking
- Track CBAM certificate purchases
- Manage certificate surrenders
- Monitor certificate balance and costs

## Technical Details

### Database Models
- **CbamGoods**: Master data for CBAM-eligible goods
- **ImportDeclaration**: Individual import records with emissions data
- **CbamQuarterlyReport**: Quarterly compliance reports

### API Endpoints

#### Goods Classification
```
GET    /api/v1/cbam/sectors              - List all CBAM sectors
GET    /api/v1/cbam/goods                - List CBAM goods for company
GET    /api/v1/cbam/goods/:id            - Get specific good details
```

#### Import Declarations
```
POST   /api/v1/cbam/imports/declare      - Record new import declaration
GET    /api/v1/cbam/imports              - List import declarations
```

#### Emissions Calculations
```
POST   /api/v1/cbam/calculate            - Calculate embedded emissions
```

#### Quarterly Reports
```
POST   /api/v1/cbam/reports/generate     - Generate quarterly report
GET    /api/v1/cbam/reports/quarterly    - Get all quarterly reports
GET    /api/v1/cbam/reports/quarterly/:year/:quarter - Get specific report
POST   /api/v1/cbam/reports/submit       - Submit report to authority
```

#### Certificates
```
GET    /api/v1/cbam/certificates         - Get certificate history
GET    /api/v1/cbam/certificates/:year/:quarter - Get certificate status
POST   /api/v1/cbam/certificates/purchase - Record certificate purchase
POST   /api/v1/cbam/certificates/surrender - Surrender certificates
```

#### Deadlines
```
GET    /api/v1/cbam/deadlines            - Get upcoming reporting deadlines
```

## Usage Examples

### Record an Import Declaration
```typescript
POST /api/v1/cbam/imports/declare
{
  "goodsId": "good-123",
  "quantity": 100,
  "quantityUnit": "tonnes",
  "importDate": "2024-03-15",
  "countryOfOrigin": "CN",
  "actualEmissions": 95,
  "installationId": "EU-DE-123456"
}
```

### Calculate Emissions
```typescript
POST /api/v1/cbam/calculate
{
  "goodsId": "good-123",
  "quantity": 100,
  "quantityUnit": "tonnes",
  "countryOfOrigin": "CN"
}
```

### Generate Quarterly Report
```typescript
POST /api/v1/cbam/reports/generate
{
  "year": 2024,
  "quarter": 1
}
```

## CBAM Methodology

### Emission Calculation Methods
1. **Actual Emissions**: Use verified installation-specific data
2. **Default Values**: Apply CBAM default emission factors when actual data unavailable

### Default Emission Factors (tCO2e per unit)
- Cement: 0.94 tCO2e/tonne
- Iron & Steel: 1.85 tCO2e/tonne
- Aluminium: 8.5 tCO2e/tonne
- Fertilizers: 2.2 tCO2e/tonne
- Electricity: 0.4 tCO2e/MWh
- Hydrogen: 10.5 tCO2e/tonne

### Certificate Pricing
- Default price: €80 per tCO2e
- Adjusted based on EU allowance prices

## Reporting Deadlines

| Quarter | Period | Deadline |
|---------|--------|----------|
| Q1 | Jan-Mar | July 30 |
| Q2 | Apr-Jun | September 30 |
| Q3 | Jul-Sep | January 31 (next year) |
| Q4 | Oct-Dec | April 30 (next year) |

## Integration Points

### Framework Registry Service
- Retrieve approved methodologies
- Map emission factors to CBAM requirements

### Security Service
- Audit trail for all CBAM transactions
- Event logging for compliance tracking

## Testing

Run unit tests:
```bash
npm test -- cbam
```

Run e2e tests:
```bash
npm run test:e2e -- cbam
```

## Environment Variables

No additional environment variables required beyond existing corporate-platform-backend configuration.

## Migration

After adding the CBAM models to Prisma schema:
```bash
npx prisma migrate dev --name add_cbam_models
npx prisma generate
```

## Compliance Notes

1. All emissions calculations follow CBAM methodology as per EU Regulation 2023/956
2. Default values aligned with implementing acts (to be updated as regulations evolve)
3. Certificate tracking compliant with CBAM registry requirements
4. Quarterly reports formatted per CBAM reporting templates

## Future Enhancements

- Integration with EU CBAM registry API
- Automated certificate purchasing
- Advanced analytics and forecasting
- Multi-country reporting support
- Verification workflow integration

## Support

For questions or issues related to CBAM compliance, contact the compliance team.
