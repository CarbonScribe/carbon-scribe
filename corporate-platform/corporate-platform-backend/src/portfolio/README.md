# Portfolio Management Service Module

## Overview

The Portfolio Management Service Module provides comprehensive portfolio data and analytics for corporate carbon credit portfolios. It includes summary metrics, performance analytics, composition breakdowns, historical timelines, and risk assessment.

## Features

- **Summary Metrics**: Total retired credits, available balance, quarterly growth, net zero progress
- **Performance Analytics**: Portfolio value, average price per ton, project diversity, trends
- **Composition Analysis**: Methodology distribution, geographic allocation, SDG impact breakdown
- **Timeline Data**: Historical portfolio growth, retirement trends, value appreciation
- **Risk Assessment**: Diversification score, risk rating, concentration analysis, volatility

## API Endpoints

### Summary Metrics
```
GET /api/v1/portfolio/summary
```
Returns portfolio summary metrics including total retired, available balance, quarterly growth, net zero progress, scope 3 coverage, SDG alignment, and cost efficiency.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRetired": 1000,
    "availableBalance": 500,
    "quarterlyGrowth": 15.5,
    "netZeroProgress": 50.0,
    "scope3Coverage": 30.0,
    "sdgAlignment": 80.0,
    "costEfficiency": 25.0,
    "lastUpdatedAt": "2025-02-27T00:00:00Z"
  },
  "timestamp": "2025-02-27T00:00:00Z"
}
```

### Performance Metrics
```
GET /api/v1/portfolio/performance
```
Returns performance metrics including portfolio value, average price per ton, credits held, project diversity, and performance trends.

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioValue": 50000.00,
    "avgPricePerTon": 15.50,
    "creditsHeld": 1000,
    "projectDiversity": 75.0,
    "performanceTrends": [
      { "month": "2025-01", "value": 100 }
    ],
    "monthlyRetirements": [
      { "month": "2025-01", "value": 5 }
    ]
  },
  "timestamp": "2025-02-27T00:00:00Z"
}
```

### Portfolio Composition
```
GET /api/v1/portfolio/composition
```
Returns portfolio breakdown by methodology, geography, and SDG impact.

**Response:**
```json
{
  "success": true,
  "data": {
    "methodologyDistribution": [
      { "name": "REDD+", "value": 600, "percentage": 60.0 }
    ],
    "geographicAllocation": [
      { "name": "Brazil", "value": 400, "percentage": 40.0 }
    ],
    "sdgImpact": [
      { "name": "SDG 13", "value": 500, "percentage": 50.0 }
    ],
    "vintageYearDistribution": [
      { "name": "2021", "value": 300, "percentage": 30.0 }
    ],
    "projectTypeClassification": [
      { "name": "VCS", "value": 700, "percentage": 70.0 }
    ]
  },
  "timestamp": "2025-02-27T00:00:00Z"
}
```

### Historical Timeline
```
GET /api/v1/portfolio/timeline?startDate=2025-01-01&endDate=2025-12-31
```
Returns historical timeline data with monthly, quarterly, and yearly aggregations.

**Query Parameters:**
- `startDate`: ISO date string (optional)
- `endDate`: ISO date string (optional)
- `aggregation`: 'monthly', 'quarterly', or 'yearly' (default: 'monthly')

**Response:**
```json
{
  "success": true,
  "data": {
    "portfolioGrowth": {
      "monthly": [
        { "date": "2025-01", "value": 1000 }
      ],
      "quarterly": [
        { "date": "2025-Q1", "value": 3000 }
      ],
      "yearly": [
        { "date": "2025", "value": 12000 }
      ]
    },
    "retirementTrends": { ... },
    "valueOverTime": { ... }
  },
  "timeRange": {
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-12-31T00:00:00Z"
  },
  "timestamp": "2025-02-27T00:00:00Z"
}
```

### Risk Assessment
```
GET /api/v1/portfolio/risk
```
Returns portfolio risk assessment including diversification score, risk rating, and concentration analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "diversificationScore": 75,
    "riskRating": "Low",
    "concentrationAnalysis": {
      "topProject": { "name": "Project 1", "percentage": 25.0 },
      "topCountry": { "name": "Brazil", "percentage": 45.0 },
      "herfindahlIndex": 2500.0
    },
    "volatility": 5.5,
    "projectQualityDistribution": {
      "highQuality": 70.0,
      "mediumQuality": 20.0,
      "lowQuality": 10.0
    }
  },
  "timestamp": "2025-02-27T00:00:00Z"
}
```

### Portfolio Holdings
```
GET /api/v1/portfolio/holdings?page=1&pageSize=20
```
Returns paginated list of all holdings in the portfolio.

**Query Parameters:**
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "holding-1",
        "quantity": 100,
        "purchasePrice": 15.0,
        "currentValue": 1000.0,
        "credit": {
          "id": "credit-1",
          "projectName": "Amazon REDD+ Project"
        }
      }
    ],
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "pages": 3
  },
  "timestamp": "2025-02-27T00:00:00Z"
}
```

### Combined Analytics Dashboard
```
GET /api/v1/portfolio/analytics
```
Returns all analytics data in a single request for dashboard display.

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": { ... },
    "performance": { ... },
    "composition": { ... },
    "timeline": { ... },
    "risk": { ... },
    "generatedAt": "2025-02-27T00:00:00Z"
  },
  "timestamp": "2025-02-27T00:00:00Z"
}
```

## Data Models

### Portfolio
Main portfolio entity tracking company holdings and metrics.

**Fields:**
- `id`: Unique identifier
- `companyId`: Reference to company (unique)
- `totalRetired`: Total credits retired
- `currentBalance`: Available balance
- `totalValue`: Current portfolio value
- `avgPricePerTon`: Average price per CO₂ ton
- `netZeroTarget`: Net zero target (tCO₂)
- `netZeroProgress`: Progress toward net zero (%)
- `scope3Coverage`: Scope 3 emissions coverage (%)
- `diversificationScore`: Portfolio diversification (0-100)
- `riskRating`: Risk assessment (Low/Medium/High)
- `avgVintage`: Average credit vintage year

### PortfolioHolding
Individual credit holdings within a portfolio.

**Fields:**
- `id`: Unique identifier
- `portfolioId`: Portfolio reference
- `creditId`: Credit reference
- `quantity`: Number of credits held
- `purchasePrice`: Price paid per credit
- `purchaseDate`: Date of purchase
- `currentValue`: Current value of holding

### PortfolioSnapshot
Historical snapshots of portfolio state for tracking trends.

**Fields:**
- `id`: Unique identifier
- `portfolioId`: Portfolio reference
- `totalValue`: Total value at snapshot
- `totalRetired`: Total retired at snapshot
- `currentBalance`: Balance at snapshot
- `methodologyDistribution`: Methodology breakdown (JSON)
- `geographicDistribution`: Geographic breakdown (JSON)
- `sdgDistribution`: SDG breakdown (JSON)
- `snapshotDate`: Timestamp of snapshot

## Services

### SummaryService
Calculates portfolio summary metrics.

- `getSummaryMetrics(companyId)`: Returns summary metrics

### PerformanceService
Calculates performance metrics and trends.

- `getPerformanceMetrics(companyId)`: Returns performance data

### CompositionService
Analyzes portfolio composition.

- `getCompositionMetrics(companyId)`: Returns composition breakdown

### TimelineService
Generates historical timeline data.

- `getTimelineMetrics(companyId, startDate?, endDate?)`: Returns timeline data

### RiskService
Assesses portfolio risk.

- `getRiskMetrics(companyId)`: Returns risk assessment

### PortfolioService
Main service coordinating all sub-services.

- `getPortfolioSummary(companyId)`
- `getPortfolioPerformance(companyId)`
- `getPortfolioComposition(companyId)`
- `getPortfolioTimeline(companyId, startDate?, endDate?)`
- `getPortfolioRisk(companyId)`
- `getPortfolioHoldings(companyId, page, pageSize)`
- `getPortfolioAnalytics(companyId)`

## Multi-tenancy

All endpoints enforce multi-tenant isolation using the `companyId` from the authenticated user. Users can only access their own portfolio data.

## Authentication & Authorization

All endpoints require:
- Valid JWT authentication token
- Permission: `PORTFOLIO_VIEW`
- Company match verification

## Error Handling

- **400 Bad Request**: Invalid query parameters or date formats
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Insufficient permissions or company mismatch
- **404 Not Found**: Portfolio not found (returns empty data)
- **500 Internal Server Error**: Server-side errors

## Testing

### Unit Tests
Run unit tests for individual services:
```bash
npm test -- src/portfolio/services/summary.service.spec.ts
npm test -- src/portfolio/services/performance.service.spec.ts
npm test -- src/portfolio/services/composition.service.spec.ts
npm test -- src/portfolio/services/timeline.service.spec.ts
npm test -- src/portfolio/services/risk.service.spec.ts
npm test -- src/portfolio/portfolio.controller.spec.ts
```

### Integration Tests
Run end-to-end tests:
```bash
npm run test:e2e -- test/portfolio.e2e-spec.ts
```

## Performance Considerations

- Queries are optimized with proper indexing on portfolio and credit tables
- Legacy snapshots strategy for historical analysis
- Efficient aggregation calculations
- Support for large portfolios (tested with 1000+ holdings)

## Future Enhancements

- Caching layer for frequently accessed metrics
- Support for portfolio simulations
- Sustainability metrics and reporting
- Integration with market data for real-time updates
- Advanced analytics and machine learning predictions
