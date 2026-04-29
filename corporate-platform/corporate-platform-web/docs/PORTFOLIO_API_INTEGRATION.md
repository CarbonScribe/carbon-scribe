# Portfolio API Integration Guide

## Overview

This document describes the integration between the frontend (Next.js) and backend (NestJS) for the Portfolio API. The integration enables users to view, analyze, and manage their carbon credit holdings and portfolio performance.

## Table of Contents

1. [Architecture](#architecture)
2. [API Endpoints](#api-endpoints)
3. [Authentication](#authentication)
4. [Frontend Integration](#frontend-integration)
5. [Error Handling](#error-handling)
6. [Configuration](#configuration)
7. [Testing](#testing)

---

## Architecture

### Backend Components

- **Portfolio Controller** (`src/portfolio/portfolio.controller.ts`): Exposes REST endpoints
- **Portfolio Service** (`src/portfolio/portfolio.service.ts`): Business logic orchestration
- **Specialized Services**: Summary, Performance, Composition, Risk, Timeline services

### Frontend Components

- **API Client** (`src/api/client.ts`): HTTP client with interceptors
- **Portfolio API** (`src/api/portfolio.ts`): Typed wrapper for all endpoints
- **usePortfolio Hook** (`src/hooks/usePortfolio.ts`): Data fetching and state management
- **UI Components** (`src/components/portfolio/`): Reusable display components

---

## API Endpoints

### 1. GET /portfolio/summary

Fetch portfolio summary metrics and KPIs.

**Request**: No parameters

**Response**:

```json
{
  "success": true,
  "data": {
    "totalRetired": 1000,
    "availableBalance": 500,
    "quarterlyGrowth": 15.5,
    "netZeroProgress": 65,
    "scope3Coverage": 45,
    "sdgAlignment": 80,
    "costEfficiency": 2.5,
    "lastUpdatedAt": "2024-03-15T00:00:00Z"
  }
}
```

### 2. GET /portfolio/performance

Fetch portfolio performance metrics and trends.

**Request**: No parameters

**Response**:

```json
{
  "success": true,
  "data": {
    "portfolioValue": 15500,
    "avgPricePerTon": 15.5,
    "creditsHeld": 1000,
    "projectDiversity": 5,
    "performanceTrends": [
      { "month": "Jan", "value": 14000 },
      { "month": "Feb", "value": 15500 }
    ],
    "monthlyRetirements": [
      { "month": "Jan", "value": 100 },
      { "month": "Feb", "value": 50 }
    ]
  }
}
```

### 3. GET /portfolio/composition

Fetch portfolio composition breakdown.

**Request**: No parameters

**Response**:

```json
{
  "success": true,
  "data": {
    "methodologyDistribution": [
      { "name": "VERRA", "value": 600, "percentage": 60 }
    ],
    "geographicAllocation": [
      { "name": "Brazil", "value": 700, "percentage": 70 }
    ],
    "sdgImpact": [{ "name": "SDG13", "value": 800, "percentage": 80 }],
    "vintageYearDistribution": [],
    "projectTypeClassification": []
  }
}
```

### 4. GET /portfolio/risk

Fetch portfolio risk analysis.

**Request**: No parameters

**Response**:

```json
{
  "success": true,
  "data": {
    "diversificationScore": 75,
    "riskRating": "Low",
    "concentrationAnalysis": {
      "topProject": { "name": "Project A", "percentage": 30 },
      "topCountry": { "name": "Brazil", "percentage": 70 },
      "herfindahlIndex": 0.25
    },
    "volatility": 0.12,
    "projectQualityDistribution": {
      "highQuality": 600,
      "mediumQuality": 300,
      "lowQuality": 100
    }
  }
}
```

### 5. GET /portfolio/holdings

Fetch paginated portfolio holdings.

**Query Parameters**:

- `page` (optional): Page number (default: 1)
- `pageSize` (optional): Items per page (default: 10)

**Response**:

```json
{
  "success": true,
  "data": {
    "holdings": [
      {
        "id": "1",
        "creditId": "c1",
        "companyId": "comp1",
        "creditAmount": 100,
        "purchasePrice": 15.5,
        "purchaseDate": "2024-01-15T00:00:00Z",
        "currentValue": 1550,
        "status": "available",
        "credit": {
          "projectName": "Test Project",
          "methodology": "VERRA",
          "country": "Brazil",
          "vintage": 2023,
          "verificationStandard": "VERRA",
          "sdgs": ["SDG13"],
          "qualityMetrics": { ... }
        }
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  }
}
```

### 6. GET /portfolio/holdings/:id

Fetch specific holding details.

**Path Parameters**:

- `id`: Holding ID

### 7. GET /portfolio/timeline

Fetch historical portfolio data.

**Query Parameters**:

- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `aggregation` (optional): daily | weekly | monthly | quarterly | yearly

### 8. GET /portfolio/analytics

Fetch combined analytics dashboard data.

**Request**: No parameters

**Response**: Combines summary, performance, composition, and risk data in a single response.

### 9. GET /portfolio/transactions

Fetch transaction history.

**Query Parameters**:

- `page` (optional): Page number
- `pageSize` (optional): Items per page

---

## Authentication

### Flow

1. **Login**: User authenticates via backend login endpoint
2. **Token Storage**: Backend sets httpOnly cookie with JWT (`Secure`, `SameSite=Strict`)
3. **Request**: Frontend includes credentials with each request (`credentials: 'include'`)
4. **Validation**: Backend validates JWT and extracts company ID from payload

### Frontend Token Handling

The frontend cannot directly read httpOnly cookies but can:

- Rely on browser's automatic cookie inclusion
- Read from a separate public payload cookie (if provided by backend)
- Verify authentication via backend endpoint

### Required Permissions

- `portfolio:view` - View portfolio data
- `portfolio:export` - Export portfolio data
- `portfolio:analyze` - Access analytics

---

## Frontend Integration

### API Client Setup

```typescript
// src/api/client.ts
import { apiClient } from "./client";

// The client automatically includes httpOnly cookies
const response = await apiClient.get("/portfolio/summary");
```

### Using the Hook

```typescript
// In a component
import { useCorporate } from "@/contexts/CorporateContext";

function MyComponent() {
  const { portfolio } = useCorporate();

  // Access data
  const summary = portfolio.summary;
  const isLoading = portfolio.isLoading;
  const error = portfolio.summaryError;

  // Refresh data
  const handleRefresh = () => portfolio.refresh();
}
```

### Component Usage

```typescript
import PortfolioSummary from '@/components/portfolio/PortfolioSummary'
import PortfolioHoldings from '@/components/portfolio/PortfolioHoldings'

function MyPage() {
  return (
    <div>
      <PortfolioSummary />
      <PortfolioHoldings />
    </div>
  )
}
```

---

## Error Handling

### Error Types

| Type                | Status Code | Retryable | User Message                  |
| ------------------- | ----------- | --------- | ----------------------------- |
| NetworkError        | 0           | Yes       | Check internet connection     |
| AuthenticationError | 401         | No        | Session expired, log in again |
| AuthorizationError  | 403         | No        | Access denied                 |
| ValidationError     | 400         | No        | Invalid data provided         |
| ServerError         | 500+        | Yes       | Server error, try again later |
| NotFoundError       | 404         | No        | Resource not found            |
| TimeoutError        | 408/504     | Yes       | Request timed out             |

### Frontend Error Handling

1. **Toast Notifications**: User-friendly messages displayed via `useToast`
2. **Error States**: Components show error UI with retry buttons
3. **Logging**: Errors logged to console with context via `logger`

### Example Error Response

```json
{
  "success": false,
  "error": "Failed to fetch holdings",
  "code": "FETCH_HOLDINGS_ERROR",
  "timestamp": "2024-03-15T00:00:00Z"
}
```

---

## Configuration

### Environment Variables

Create `.env.local` in the frontend root:

```env
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_ENV=development

# Feature Flags
NEXT_PUBLIC_ENABLE_PORTFOLIO_API=true
```

### Backend Configuration

Ensure the following environment variables are set:

```env
# JWT
JWT_SECRET=your-jwt-secret

# CORS
CORS_ORIGIN=http://localhost:3000

# Database
DATABASE_URL=postgresql://...
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Test Structure

```
src/
├── api/
│   ├── __tests__/
│   │   ├── client.spec.ts      # API client tests
│   │   └── portfolio.spec.ts   # Portfolio API tests
│   ├── client.ts
│   ├── portfolio.ts
│   └── types.ts
├── components/
│   └── portfolio/
│       └── __tests__/         # Component tests
├── hooks/
│   ├── __tests__/
│   │   └── usePortfolio.spec.ts
│   └── usePortfolio.ts
└── __tests__/
    └── setup.ts               # Jest setup
```

### Test Coverage Goals

- **API Client**: 80%+ coverage
- **Portfolio API**: 80%+ coverage
- **Components**: 70%+ coverage
- **Overall**: 50%+ coverage (configurable in jest.config.js)

---

## Adding New Features

### 1. Add API Endpoint

```typescript
// src/api/portfolio.ts
async getNewFeature(): Promise<NewFeatureType> {
  const response = await apiClient.get<NewFeatureType>('/portfolio/new-feature')
  if (!response.success) {
    throw new ApiErrorClass(...)
  }
  return response.data
}
```

### 2. Add Hook Method

```typescript
// src/hooks/usePortfolio.ts
const fetchNewFeature = useCallback(async () => {
  setLoading((prev) => ({ ...prev, newFeature: true }));
  try {
    const data = await portfolioAPI.getNewFeature();
    setData((prev) => ({ ...prev, newFeature: data }));
  } catch (error) {
    // Handle error
  } finally {
    setLoading((prev) => ({ ...prev, newFeature: false }));
  }
}, []);
```

### 3. Add Component

```typescript
// src/components/portfolio/NewFeature.tsx
export function NewFeature() {
  const { portfolio } = useCorporate()
  const { newFeature, isLoadingNewFeature } = portfolio

  if (isLoadingNewFeature) return <LoadingSkeleton />
  if (!newFeature) return <EmptyState />

  return <div>{/* Render data */}</div>
}
```

---

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check backend CORS configuration
   - Verify frontend origin is whitelisted

2. **Authentication Failures**
   - Verify httpOnly cookie is being set
   - Check JWT secret matches between services

3. **Data Not Loading**
   - Check API endpoint is accessible
   - Verify response format matches expected schema

4. **Type Errors**
   - Ensure TypeScript types match API response
   - Run `npm run build` to check for type errors

### Debug Mode

Set `NEXT_PUBLIC_APP_ENV=development` to enable detailed logging.

---

## Related Files

### Backend

- [Portfolio Controller](corporate-platform-backend/src/portfolio/portfolio.controller.ts)
- [Portfolio Service](corporate-platform-backend/src/portfolio/portfolio.service.ts)
- [Prisma Schema](corporate-platform-backend/prisma/schema.prisma)

### Frontend

- [API Client](src/api/client.ts)
- [Portfolio API](src/api/portfolio.ts)
- [usePortfolio Hook](src/hooks/usePortfolio.ts)
- [Corporate Context](src/contexts/CorporateContext.tsx)
- [Portfolio Page](src/app/portfolio/page.tsx)
