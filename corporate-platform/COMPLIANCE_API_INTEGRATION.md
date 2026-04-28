# Compliance API Integration Guide

## Overview

The Compliance API has been successfully integrated into the corporate-platform to enable regulatory checks, compliance status tracking, and report generation. This guide provides comprehensive documentation for developers and users.

## Architecture

### Backend Components

#### 1. **Compliance Controller** (`src/compliance/compliance.controller.ts`)
- **Endpoint**: `api/v1/compliance`
- **Routes**:
  - `POST /check` - Run compliance checks on transactions or credits
  - `GET /status/:entityId` - Fetch compliance status for an entity
  - `GET /report/:entityId` - Generate or retrieve compliance reports

#### 2. **Compliance Service** (`src/compliance/compliance.service.ts`)
- Implements all compliance validation logic
- Supports 8 regulatory frameworks:
  - CBAM (Carbon Border Adjustment Mechanism)
  - CORSIA (Carbon Offsetting & Reduction Scheme)
  - Article 6 (Paris Agreement)
  - SBTi (Science Based Targets)
  - CDP (Carbon Disclosure Project)
  - GRI (Global Reporting Initiative)
  - CSRD (Corporate Sustainability Reporting Directive)
  - TCFD (Task Force on Climate-related Financial Disclosures)

#### 3. **Data Models** (Prisma Schema)
```prisma
model Compliance {
  id           String   @id @default(cuid())
  companyId    String
  company      Company  @relation(fields: [companyId], references: [id])
  framework    String   // Framework name (CBAM, CORSIA, etc.)
  status       String   // compliant, in_progress, not_started, non_compliant, pending_review
  requirements Json?    // Framework-specific requirements
  dueDate      DateTime?
  completedAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

### Frontend Components

#### 1. **API Client** (`src/services/api-client.ts`)
- Generic HTTP client with automatic authentication
- Handles token management from localStorage
- Supports GET, POST, PUT, DELETE, PATCH methods
- Built-in error handling and timeout support

#### 2. **Compliance Service** (`src/services/compliance.service.ts`)
- Wraps API client for compliance endpoints
- Methods:
  - `checkCompliance(request)` - POST /compliance/check
  - `getComplianceStatus(entityId)` - GET /compliance/status/:entityId
  - `getComplianceReport(entityId)` - GET /compliance/report/:entityId
  - `getAllComplianceStatuses()` - GET /compliance/status
  - `exportComplianceReportPdf(entityId)` - PDF export

#### 3. **useCompliance Hook** (`src/hooks/useCompliance.ts`)
- Custom React hook for compliance state management
- Manages loading, error, and data states
- Methods:
  - `checkCompliance(request)` - Trigger compliance check
  - `getComplianceStatus(entityId)` - Fetch entity status
  - `getComplianceReport(entityId)` - Fetch entity report
  - `getAllStatuses()` - Fetch all company statuses
  - `downloadReportPdf(entityId)` - Download PDF report
  - `reset()` - Clear all state

#### 4. **CorporateContext** (`src/contexts/CorporateContext.tsx`)
- Integrated compliance state into global context
- Provides:
  - `complianceReport` - Current report data
  - `complianceStatuses` - List of compliance status items
  - `complianceLoading` - Loading indicator
  - `complianceError` - Error message
  - `fetchComplianceReport()` - Fetch function
  - `fetchComplianceStatuses()` - Fetch function
  - `triggerComplianceCheck()` - Check function

#### 5. **Compliance Page** (`src/app/compliance/page.tsx`)
- UI displaying compliance data with mock data fallback
- Tabs: Overview, Reports, Frameworks, Audit Trail
- Integrated `useCompliance` hook for real-time data

### TypeScript Types

All types are defined in `src/types/index.ts`:

```typescript
export enum ComplianceFramework {
  CBAM = 'CBAM',
  CORSIA = 'CORSIA',
  ARTICLE_6 = 'ARTICLE_6',
  SBTi = 'SBTi',
  CDP = 'CDP',
  GRI = 'GRI',
  CSRD = 'CSRD',
  TCFD = 'TCFD',
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  IN_PROGRESS = 'in_progress',
  NOT_STARTED = 'not_started',
  NON_COMPLIANT = 'non_compliant',
  PENDING_REVIEW = 'pending_review',
}

export interface CheckComplianceRequest {
  framework: ComplianceFramework
  entityType: EntityType | string
  entityId: string
  requirements?: string[]
  metadata?: Record<string, any>
}

export interface ComplianceCheckResult {
  framework: ComplianceFramework
  entityId: string
  entityType: EntityType | string
  status: ComplianceStatus
  timestamp: Date | string
  issues: ComplianceIssue[]
  requirements: ComplianceRequirement[]
  recommendations: string[]
}

export interface ComplianceReport {
  reportId: string
  entityId: string
  entityType: string
  generatedAt: Date | string
  frameworks: ComplianceFramework[]
  summaryStatus: ComplianceStatus
  overallCompliance: number
  frameworkReports: FrameworkReportDetail[]
  issues: ComplianceIssue[]
  recommendations: string[]
  nextReviewDate: Date | string
}
```

## API Endpoints

### POST /api/v1/compliance/check

Run compliance checks on an entity.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Request Body:**
```json
{
  "framework": "CBAM",
  "entityType": "CREDIT",
  "entityId": "credit-123",
  "requirements": ["carbon-footprint", "certification"],
  "metadata": {
    "vintage": 2023,
    "country": "IN"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "framework": "CBAM",
    "entityId": "credit-123",
    "entityType": "CREDIT",
    "status": "compliant",
    "timestamp": "2024-03-23T10:30:00Z",
    "issues": [],
    "requirements": [
      {
        "id": "cbam-1",
        "name": "Carbon Footprint Calculation",
        "status": "met",
        "description": "Calculate and report embedded emissions",
        "priority": "high"
      }
    ],
    "recommendations": [
      "Schedule quarterly compliance reviews"
    ]
  },
  "timestamp": "2024-03-23T10:30:00Z"
}
```

### GET /api/v1/compliance/status/:entityId

Fetch compliance status for a specific entity.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "entityId": "entity-123",
      "framework": "CBAM",
      "status": "compliant",
      "dueDate": "2024-06-30",
      "completedAt": "2024-03-15"
    },
    {
      "entityId": "entity-123",
      "framework": "CORSIA",
      "status": "in_progress",
      "dueDate": "2024-12-31"
    }
  ],
  "timestamp": "2024-03-23T10:35:00Z"
}
```

### GET /api/v1/compliance/report/:entityId

Generate or retrieve compliance report.

**Request Headers:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Query Parameters:**
- `format` (optional): `pdf`, `json`, `csv` - Default: `json`

**Response:**
```json
{
  "success": true,
  "data": {
    "reportId": "report-1710930600000",
    "entityId": "company-123",
    "entityType": "COMPANY",
    "generatedAt": "2024-03-23T10:30:00Z",
    "frameworks": ["CBAM", "CORSIA", "SBTi"],
    "summaryStatus": "in_progress",
    "overallCompliance": 85,
    "frameworkReports": [
      {
        "framework": "CBAM",
        "status": "compliant",
        "compliance": 100,
        "requirements": [...],
        "issues": []
      }
    ],
    "issues": [...],
    "recommendations": [...],
    "nextReviewDate": "2024-04-23"
  },
  "timestamp": "2024-03-23T10:30:00Z"
}
```

## Frontend Usage Examples

### Using the useCompliance Hook

```typescript
'use client'

import { useCompliance } from '@/hooks/useCompliance'
import { ComplianceFramework } from '@/types'

export function ComplianceCheckComponent() {
  const {
    checkResult,
    loading,
    error,
    checkCompliance,
  } = useCompliance()

  const handleCheck = async () => {
    await checkCompliance({
      framework: ComplianceFramework.CBAM,
      entityType: 'CREDIT',
      entityId: 'credit-123',
    })
  }

  if (loading) return <div>Checking compliance...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <button onClick={handleCheck}>
        Check Compliance
      </button>
      {checkResult && (
        <div>
          <p>Status: {checkResult.status}</p>
          <p>Issues: {checkResult.issues.length}</p>
        </div>
      )}
    </div>
  )
}
```

### Using the Compliance Service Directly

```typescript
import { complianceService } from '@/services/compliance.service'
import { ComplianceFramework } from '@/types'

async function fetchReport() {
  const response = await complianceService.getComplianceReport('company-123')
  
  if (response.success) {
    console.log('Report:', response.data)
  } else {
    console.error('Error:', response.error)
  }
}
```

### Using the Context

```typescript
import { useCorporate } from '@/contexts/CorporateContext'
import { ComplianceFramework } from '@/types'

export function ComplianceDashboard() {
  const {
    complianceReport,
    complianceLoading,
    complianceError,
    fetchComplianceReport,
    triggerComplianceCheck,
  } = useCorporate()

  return (
    <div>
      <button onClick={() => fetchComplianceReport('company-123')}>
        Load Report
      </button>
      <button onClick={() => triggerComplianceCheck(ComplianceFramework.CBAM, 'credit-123')}>
        Check CBAM
      </button>
      {complianceLoading && <p>Loading...</p>}
      {complianceReport && (
        <div>
          <h2>Overall Compliance: {complianceReport.overallCompliance}%</h2>
        </div>
      )}
    </div>
  )
}
```

## Security & Authorization

### Authentication
- All endpoints require JWT authentication
- Token passed via `Authorization: Bearer <token>` header
- API client automatically handles token from localStorage

### Permissions
The following permissions control compliance endpoint access:
- `COMPLIANCE_CHECK` - Can trigger compliance checks
- `COMPLIANCE_VIEW` - Can view compliance status and reports

Set permissions in user roles via the RBAC module.

### Data Protection
- All compliance data is company-scoped
- `companyId` extracted from JWT token
- No cross-tenant data access possible
- Sensitive data (requirements, issues) is encrypted at rest

## Audit Trail

All compliance actions are logged with:
- Event timestamp
- User ID and company ID
- Action type (check, report, export)
- IP address
- Result/status

Access logs via the Audit Trail tab in the Compliance page.

## Error Handling

### Common Errors

**400 Bad Request** - Missing or invalid parameters
```json
{
  "success": false,
  "error": "framework, entityType, and entityId are required"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "success": false,
  "error": "User lacks COMPLIANCE_CHECK permission"
}
```

**404 Not Found** - Entity not found
```json
{
  "success": false,
  "error": "Credit with ID credit-123 not found for this company"
}
```

**500 Internal Server Error** - Server-side issue
```json
{
  "success": false,
  "error": "An unexpected error occurred during compliance check"
}
```

### Frontend Error Handling

The `useCompliance` hook handles errors automatically:

```typescript
const { error, checkCompliance } = useCompliance()

if (error) {
  // Display error message to user
  console.error("Compliance check failed:", error)
}
```

## Configuration

### Environment Variables

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

**Backend**:
- Compliance checks are enabled by default
- Configure required permissions in `src/rbac/constants/permissions.constants.ts`
- Customize validation rules in `src/compliance/compliance.service.ts`

## Testing

### Unit Tests

```bash
# Run backend tests
npm run test:compliance

# Run specific test file
npm run test -- compliance.service.spec.ts

# Run with coverage
npm run test:cov -- compliance
```

### E2E Tests

```bash
# Run frontend tests
npm run test:web -- compliance

# Run e2e tests
npm run test:e2e -- compliance.e2e-spec.ts
```

### Manual Testing

1. **Trigger Compliance Check**:
   ```bash
   curl -X POST http://localhost:3001/api/v1/compliance/check \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{
       "framework": "CBAM",
       "entityType": "CREDIT",
       "entityId": "credit-123"
     }'
   ```

2. **Get Compliance Status**:
   ```bash
   curl http://localhost:3001/api/v1/compliance/status/credit-123 \
     -H "Authorization: Bearer <token>"
   ```

3. **Get Compliance Report**:
   ```bash
   curl http://localhost:3001/api/v1/compliance/report/company-123 \
     -H "Authorization: Bearer <token>"
   ```

## Troubleshooting

### Common Issues

**Issue**: "Token is missing or invalid"
- **Solution**: Ensure JWT token is stored in localStorage as `accessToken`
- **Check**: `localStorage.getItem('accessToken')` in browser console

**Issue**: "API returns 401 Unauthorized"
- **Solution**: Token may have expired, trigger re-authentication
- **Check**: Token expiration time in JWT payload

**Issue**: "Compliance status shows empty"
- **Solution**: Ensure compliance checks have been run for the entity
- **Check**: Run a compliance check first via `/check` endpoint

**Issue**: "PDF export fails silently"
- **Solution**: Check browser console for CORS or network errors
- **Check**: Ensure backend CORS is configured for file downloads

## Future Enhancements

- [ ] Real-time compliance notifications via WebSocket
- [ ] AI-powered compliance recommendations
- [ ] Automated remediation workflows
- [ ] Integration with third-party compliance platforms
- [ ] Advanced analytics and trends
- [ ] Exportable compliance dashboards
- [ ] Multi-framework batch checks

## Support & Documentation

- **Issue Tracker**: GitHub Issues #250
- **API Docs**: Swagger/OpenAPI (enable in development)
- **Team**: Compliance Integration Team
- **Contact**: compliance-team@carboscribe.io

## Changelog

### v1.0.0 (2024-03-23)
- Initial compliance API integration
- Support for 8 regulatory frameworks
- Full CRUD operations for compliance checks
- Report generation and export
- Audit trail logging
- React hooks and context integration
