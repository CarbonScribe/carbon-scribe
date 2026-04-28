# CarbonScribe Corporate Platform

A modern Next.js web application for corporate buyers to purchase, manage, and retire carbon credits with transparent, on-chain verification.

## Features

- **Dashboard Overview**: Real-time portfolio metrics and performance analytics
- **Credit Marketplace**: Browse and purchase verified carbon credits
- **Instant Retirement**: Retire credits with on-chain verification
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

## Environment Variables

Create `.env.local` from `.env.example` and configure:

- `NEXT_PUBLIC_API_BASE_URL`: Base URL for backend API (example: `http://localhost:4000`)
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