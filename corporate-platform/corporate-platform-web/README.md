# CarbonScribe Corporate Platform

A modern Next.js web application for corporate buyers to purchase, manage, and retire carbon credits with transparent, on-chain verification.

## Features

- **Dashboard Overview**: Real-time portfolio metrics and performance analytics
- **Credit Marketplace**: Browse and purchase verified carbon credits
- **Instant Retirement**: Retire credits with on-chain verification
- **Retirement Scheduling**: Create, edit, and cancel future retirement events with reminder windows
- **Retirement Analytics**: Live impact, trend, forecast, and sustainability progress dashboards
- **Portfolio Analytics**: Visual breakdown by methodology and region
- **Live Retirement Feed**: Real-time updates on corporate retirements
- **Stellar Transfer Center**: Initiate single and batch blockchain transfers, poll live status, and track on-chain confirmations
- **Compliance Reporting**: Generate ESG and sustainability reports
- **Dark/Light Mode**: Full theme support
- **Mobile Responsive**: Optimized for all device sizes

## Tech Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Data visualization
- **Lucide React** - Icon library
- **Next Themes** - Dark/light mode
- **Zustand** - State management
- **React Hook Form** - Form handling
- **Zod** - Schema validation

## Stellar API Integration

The retirement view includes a Stellar Transfer Center that integrates with backend endpoints:

- `POST /api/v1/stellar/transfers`
- `POST /api/v1/stellar/transfers/batch`
- `GET /api/v1/stellar/purchases/:id/transfer-status`

Compatibility note:

- The web client falls back to `GET /api/v1/purchases/:id/transfer-status` if needed.

What is included:

- Typed Stellar API client with centralized error handling
- Single transfer and batch transfer workflows
- Purchase-based transfer status lookup
- Real-time polling for pending transfers
- On-chain activity table with direct explorer links

## Retirement Scheduling Integration

The retirement view now integrates backend scheduling endpoints for full lifecycle management:

- `POST /api/v1/retirement-scheduling`
- `GET /api/v1/retirement-scheduling`
- `GET /api/v1/retirement-scheduling/:id`
- `PUT /api/v1/retirement-scheduling/:id`
- `DELETE /api/v1/retirement-scheduling/:id`

What is included:

- Typed scheduling API service in `src/services/retirement-scheduling.service.ts`
- Scheduling manager UI in `src/components/retirement/RetirementSchedulingManager.tsx`
- Upcoming reminder cards based on `notifyBefore` and each schedule's `nextRunDate`
- Unit and component tests for API methods and scheduling create/cancel/error flows

## Retirement Analytics Integration

The analytics page now integrates Retirement Analytics API endpoints:

- `GET /api/v1/retirement-analytics/purpose-breakdown`
- `GET /api/v1/retirement-analytics/trends`
- `GET /api/v1/retirement-analytics/forecast`
- `GET /api/v1/retirement-analytics/impact`
- `GET /api/v1/retirement-analytics/progress`
- `GET /api/v1/retirement-analytics/summary`

What is included:

- Typed analytics client in `src/services/retirement-analytics.service.ts`
- Retirement analytics dashboard component in `src/components/analytics/RetirementAnalyticsDashboard.tsx`
- Filter support for time range and aggregation (monthly/quarterly)
- Resilient loading, error, and empty-state handling
- Unit/component tests for analytics API wiring and UI states

## Environment Variables

Create `.env.local` from `.env.example` and configure:

- `NEXT_PUBLIC_API_URL`: Base URL for backend API (example: `http://localhost:4000/api/v1`)
- `NEXT_PUBLIC_STELLAR_EXPLORER_BASE_URL`: Explorer prefix used for transfer links

## Testing

Run frontend tests (unit + component integration):

- `npm test`
- `npm run test:watch`

## Project Structure


```
src/
├── app/
│   ├── analytics/
│   ├── api/
│   ├── compliance/
│   ├── corporate/
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   ├── marketplace/
│   ├── page.tsx
│   ├── portfolio/
│   ├── projects/
│   ├── reporting/
│   ├── retirement/
│   ├── settings/
│   └── team/
├── components/
│   ├── actions/
│   ├── analytics/
│   ├── dashboard/
│   ├── feed/
│   ├── goals/
│   ├── layout/
│   ├── marketplace/
│   ├── reporting/
│   ├── retirement/
│   └── theme/
├── contexts/
│   └── CorporateContext.tsx
├── hooks/
│   └── useTheme.ts
├── lib/
│   ├── analytics/
│   ├── compliance/
│   └── mockData.ts
├── types/
│   └── index.ts
```

---