# Portfolio API Integration - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                            │
│                     (Next.js React Components)                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PORTFOLIO DASHBOARD                            │
│                   /app/portfolio/page.tsx                           │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Summary    │  │ Performance  │  │ Composition  │            │
│  │   Component  │  │    Chart     │  │  Breakdown   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │     Risk     │  │   Holdings   │  │   Timeline   │            │
│  │   Metrics    │  │    Table     │  │    Chart     │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────────────────────────────────────────┐             │
│  │          Transaction History                     │             │
│  └──────────────────────────────────────────────────┘             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CORPORATE CONTEXT                              │
│                 contexts/CorporateContext.tsx                       │
│                                                                     │
│  • Global state management                                         │
│  • Portfolio data access                                           │
│  • User session management                                         │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PORTFOLIO HOOK                                 │
│                   hooks/usePortfolio.ts                             │
│                                                                     │
│  • State management (data, loading, errors)                        │
│  • Fetch methods for all endpoints                                 │
│  • Error handling and retry logic                                  │
│  • Pagination support                                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PORTFOLIO API CLIENT                           │
│                     api/portfolio.ts                                │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  getPortfolioSummary()      → /portfolio/summary           │  │
│  │  getPerformanceAnalytics()  → /portfolio/performance       │  │
│  │  getComposition()           → /portfolio/composition       │  │
│  │  getRiskAnalysis()          → /portfolio/risk              │  │
│  │  getHoldings()              → /portfolio/holdings          │  │
│  │  getHoldingDetails(id)      → /portfolio/holdings/:id      │  │
│  │  getTimeline()              → /portfolio/timeline          │  │
│  │  getAnalytics()             → /portfolio/analytics         │  │
│  │  getTransactions()          → /portfolio/transactions      │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        HTTP CLIENT                                  │
│                      api/client.ts                                  │
│                                                                     │
│  • Request/Response interceptors                                   │
│  • Authentication (httpOnly cookies)                               │
│  • Error handling and transformation                               │
│  • Automatic retry logic                                           │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ HTTP/HTTPS
                             │ credentials: 'include'
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      BACKEND API GATEWAY                            │
│                    NestJS Application                               │
│                   http://localhost:3001                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYER                             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ JWT Auth     │  │ RBAC Guard   │  │ IP Whitelist │            │
│  │ Guard        │  │              │  │ Guard        │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PORTFOLIO CONTROLLER                             │
│              portfolio/portfolio.controller.ts                      │
│                                                                     │
│  GET /api/v1/portfolio/summary                                     │
│  GET /api/v1/portfolio/performance                                 │
│  GET /api/v1/portfolio/composition                                 │
│  GET /api/v1/portfolio/risk                                        │
│  GET /api/v1/portfolio/holdings                                    │
│  GET /api/v1/portfolio/holdings/:id                                │
│  GET /api/v1/portfolio/timeline                                    │
│  GET /api/v1/portfolio/analytics                                   │
│  GET /api/v1/portfolio/transactions                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PORTFOLIO SERVICE                                │
│               portfolio/portfolio.service.ts                        │
│                                                                     │
│  • Business logic orchestration                                    │
│  • Data aggregation                                                │
│  • Multi-tenant isolation                                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SPECIALIZED SERVICES                             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │   Summary    │  │ Performance  │  │ Composition  │            │
│  │   Service    │  │   Service    │  │   Service    │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │   Timeline   │  │     Risk     │                               │
│  │   Service    │  │   Service    │                               │
│  └──────────────┘  └──────────────┘                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PRISMA ORM                                     │
│                                                                     │
│  • Type-safe database queries                                      │
│  • Connection pooling                                              │
│  • Transaction management                                          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      POSTGRESQL DATABASE                            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Portfolio   │  │   Holding    │  │  Snapshot    │            │
│  │    Table     │  │    Table     │  │    Table     │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐                               │
│  │   Credit     │  │ Transaction  │                               │
│  │    Table     │  │    Table     │                               │
│  └──────────────┘  └──────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

### 1. User Loads Portfolio Page

```
User → Portfolio Page → Corporate Context → usePortfolio Hook
                                              ↓
                                         fetchAll()
                                              ↓
                        ┌─────────────────────┴─────────────────────┐
                        ▼                     ▼                     ▼
                  fetchSummary()      fetchPerformance()    fetchComposition()
                        ↓                     ▼                     ▼
                  portfolioAPI        portfolioAPI          portfolioAPI
                        ↓                     ▼                     ▼
                   apiClient            apiClient             apiClient
                        ↓                     ▼                     ▼
                  Backend API          Backend API           Backend API
                        ↓                     ▼                     ▼
                   Database             Database              Database
                        ↓                     ▼                     ▼
                   Response             Response              Response
                        ↓                     ▼                     ▼
                  Update State         Update State          Update State
                        ↓                     ▼                     ▼
                  Re-render            Re-render             Re-render
```

### 2. User Clicks Refresh Button

```
User Click → handleRefresh() → portfolio.fetchAll()
                                      ↓
                              Parallel API Calls
                                      ↓
                              Update All States
                                      ↓
                              Re-render Components
```

### 3. User Navigates Holdings Pages

```
User Click → handlePageChange(page) → fetchHoldings({ page, pageSize })
                                              ↓
                                      portfolioAPI.getHoldings()
                                              ↓
                                      Backend API with pagination
                                              ↓
                                      Database query with LIMIT/OFFSET
                                              ↓
                                      Update holdings state
                                              ↓
                                      Re-render table
```

## Component Hierarchy

```
PortfolioPage
├── PortfolioHeader
│   ├── TotalValue
│   └── NetZeroProgress
├── PortfolioSummary
│   ├── MetricCard (Total Retired)
│   ├── MetricCard (Available Balance)
│   ├── MetricCard (Quarterly Growth)
│   ├── MetricCard (Net Zero Progress)
│   ├── MetricCard (Scope 3 Coverage)
│   └── MetricCard (SDG Alignment)
├── PerformanceChart
│   ├── AreaChart (Portfolio Value)
│   ├── LineChart (Retirements)
│   └── MetricsSummary
├── CompositionBreakdown
│   ├── TabNavigation
│   ├── PieChart (Methodology/Geography/SDG)
│   ├── BarChart (Vintage/Project Type)
│   └── Legend
├── RiskMetrics
│   ├── RiskRating
│   ├── DiversificationScore
│   ├── ConcentrationAnalysis
│   ├── VolatilityMeter
│   └── QualityDistribution
├── TimelineChart
│   ├── AggregationSelector
│   ├── LineChart (Growth/Retirements/Value)
│   └── Legend
├── PortfolioHoldings
│   ├── HoldingsTable
│   │   ├── TableHeader
│   │   ├── TableRow (multiple)
│   │   └── TableFooter
│   └── Pagination
└── TransactionHistory
    ├── FilterBar
    ├── TransactionTable
    │   ├── TableHeader
    │   ├── TableRow (multiple)
    │   └── TableFooter
    └── Pagination
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    usePortfolio Hook                        │
│                                                             │
│  State:                                                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ data: {                                             │  │
│  │   summary: PortfolioSummary | null                  │  │
│  │   performance: PortfolioPerformance | null          │  │
│  │   composition: PortfolioComposition | null          │  │
│  │   riskAnalysis: RiskAnalysis | null                 │  │
│  │   holdings: PaginatedHoldings | null                │  │
│  │   analytics: PortfolioAnalytics | null              │  │
│  │   timeline: TimelineDataPoint[] | null              │  │
│  │   transactions: Transaction[] | null                │  │
│  │   selectedHolding: PortfolioHolding | null          │  │
│  │ }                                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Loading:                                                   │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ loading: {                                          │  │
│  │   summary: boolean                                  │  │
│  │   performance: boolean                              │  │
│  │   composition: boolean                              │  │
│  │   riskAnalysis: boolean                             │  │
│  │   holdings: boolean                                 │  │
│  │   analytics: boolean                                │  │
│  │   timeline: boolean                                 │  │
│  │   transactions: boolean                             │  │
│  │   selectedHolding: boolean                          │  │
│  │ }                                                    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Errors:                                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ errors: {                                           │  │
│  │   summary: AppError | null                          │  │
│  │   performance: AppError | null                      │  │
│  │   composition: AppError | null                      │  │
│  │   riskAnalysis: AppError | null                     │  │
│  │   holdings: AppError | null                         │  │
│  │   analytics: AppError | null                        │  │
│  │   timeline: AppError | null                         │  │
│  │   transactions: AppError | null                     │  │
│  │   selectedHolding: AppError | null                  │  │
│  │ }                                                    │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                        │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   1. TRANSPORT SECURITY                     │
│                                                             │
│  • HTTPS/TLS encryption                                    │
│  • Secure cookie transmission                              │
│  • CORS configuration                                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   2. AUTHENTICATION                         │
│                                                             │
│  • JWT tokens in httpOnly cookies                          │
│  • Token expiration (1 day)                                │
│  • Automatic token refresh                                 │
│  • Session management                                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   3. AUTHORIZATION                          │
│                                                             │
│  • RBAC permission checks                                  │
│  • PORTFOLIO_VIEW permission required                      │
│  • Role-based access control                               │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   4. MULTI-TENANT ISOLATION                 │
│                                                             │
│  • Company ID from JWT payload                             │
│  • Database queries filtered by companyId                  │
│  • No cross-company data access                            │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   5. IP WHITELISTING                        │
│                                                             │
│  • Optional IP-based access control                        │
│  • Configurable whitelist                                  │
│  • Geographic restrictions                                 │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   6. AUDIT LOGGING                          │
│                                                             │
│  • All portfolio access logged                             │
│  • User, company, resource tracked                         │
│  • Timestamp and status recorded                           │
└─────────────────────────────────────────────────────────────┘
```

## Error Handling Flow

```
API Call
   ↓
Try Block
   ↓
┌──────────────────────────────────────┐
│ Success?                             │
├──────────────────────────────────────┤
│ YES                  │ NO            │
│ ↓                    │ ↓             │
│ Parse Response       │ Catch Error   │
│ ↓                    │ ↓             │
│ Update State         │ Identify Type │
│ ↓                    │ ↓             │
│ Re-render            │ Transform     │
│                      │ ↓             │
│                      │ Set Error     │
│                      │ ↓             │
│                      │ Show Toast    │
│                      │ ↓             │
│                      │ Log Error     │
│                      │ ↓             │
│                      │ Re-render     │
└──────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────┐
│                   OPTIMIZATION STRATEGIES                   │
└─────────────────────────────────────────────────────────────┘

1. Parallel Data Fetching
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Summary  │  │Performance│  │Composition│
   └────┬─────┘  └────┬─────┘  └────┬─────┘
        │             │             │
        └─────────────┴─────────────┘
                      ↓
              Promise.allSettled()
                      ↓
              All data loaded simultaneously

2. Pagination
   Database → LIMIT 20 OFFSET 0 → Frontend
   • Reduces data transfer
   • Faster queries
   • Better UX

3. Memoization
   useCallback → Stable function references
   useMemo → Cached computed values
   React.memo → Prevent unnecessary re-renders

4. Code Splitting
   Dynamic imports → Lazy loading
   Route-based splitting → Smaller bundles
   Component-level splitting → On-demand loading

5. Caching (Future)
   Redis → Frequently accessed data
   Browser cache → Static assets
   Service worker → Offline support
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│ Framework:        Next.js 14 (App Router)                   │
│ Language:         TypeScript                                │
│ UI Library:       React 18                                  │
│ State:            React Hooks + Context API                 │
│ Charts:           Recharts                                  │
│ Styling:          Tailwind CSS                              │
│ HTTP Client:      Fetch API                                 │
│ Testing:          Jest + React Testing Library              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                              │
├─────────────────────────────────────────────────────────────┤
│ Framework:        NestJS                                    │
│ Language:         TypeScript                                │
│ ORM:              Prisma                                    │
│ Database:         PostgreSQL                                │
│ Auth:             JWT (Passport)                            │
│ Validation:       class-validator                           │
│ Testing:          Jest                                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      INFRASTRUCTURE                         │
├─────────────────────────────────────────────────────────────┤
│ Database:         PostgreSQL 14+                            │
│ Cache:            Redis (future)                            │
│ Deployment:       Docker                                    │
│ CI/CD:            GitHub Actions (future)                   │
└─────────────────────────────────────────────────────────────┘
```

---

**Document Version**: 1.0  
**Last Updated**: 2024-03-15  
**Status**: Complete ✅
