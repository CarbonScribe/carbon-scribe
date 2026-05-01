# Auction Integration — Frontend Documentation

## Overview

This document describes the integration of the backend Auction API endpoints into
`corporate-platform-web` for the Marketplace Bidding feature (Issue #248).

The implementation connects the existing **Dutch Auction** backend at
`/api/v1/auctions` to a fully featured bidding UI accessible from
`/marketplace/auctions`.

---

## Architecture

```
corporate-platform-web/src/
├── types/
│   └── auction.ts              ← TypeScript types for Auction, Bid, payloads
├── services/
│   └── auction.service.ts      ← API client: all auction endpoint calls
├── hooks/
│   └── useAuction.ts           ← React hooks: useAuctionList, useAuctionDetail
└── components/
│   └── marketplace/
│       ├── AuctionCard.tsx      ← Summary card (used in list view)
│       ├── AuctionList.tsx      ← Sectioned grid (Live / Other)
│       ├── AuctionDetail.tsx    ← Full detail view (orchestrator)
│       ├── PlaceBidForm.tsx     ← Controlled bid form with validation
│       └── BidHistoryTable.tsx  ← Sortable bid history table
└── app/
    └── marketplace/
        ├── page.tsx             ← Credits page (tab added: Auctions)
        └── auctions/
            ├── page.tsx         ← Auction list page (/marketplace/auctions)
            └── [id]/
                └── page.tsx     ← Auction detail page (/marketplace/auctions/:id)
```

---

## Mapped API Endpoints

| Issue Requirement          | Backend Route               | Service Method                    |
|----------------------------|-----------------------------|-----------------------------------|
| GET /auction               | GET /api/v1/auctions        | `auctionService.getAuctions()`    |
| GET /auction/:id           | GET /api/v1/auctions/:id    | `auctionService.getAuctionById()` |
| POST /auction/:id/bid      | POST /api/v1/auctions/:id/bids | `auctionService.placeBid()`    |
| GET /auction/:id/bids      | GET /api/v1/auctions/:id/bids  | `auctionService.getAuctionBids()` |
| GET /auction/:id/status    | GET /api/v1/auctions/:id    | `auctionService.getAuctionStatus()` |

> **Note:** The backend does not expose a dedicated `/status` endpoint.
> `getAuctionStatus()` delegates to `getAuctionById()`, which includes the
> dynamically computed `currentPrice` for the Dutch auction mechanism.

---

## Real-Time Updates

Active auctions are polled every **15 seconds** via `useAuctionDetail`.
The poll interval is defined in `src/hooks/useAuction.ts`:

```ts
const POLL_INTERVAL_MS = 15_000;
```

Polling starts when `auction.status === 'active'` and stops automatically
when the auction ends or the component unmounts. A WebSocket upgrade path is
available when the backend introduces a WebSocket gateway — replace the polling
interval with a socket subscription in `useAuctionDetail`.

---

## Hooks API

### `useAuctionList()`

Fetches all auctions and exposes a `refresh` callback.

```ts
const { auctions, loading, error, refresh } = useAuctionList();
```

### `useAuctionDetail(auctionId: string)`

Manages the full detail lifecycle for a single auction:
- Fetches auction + bid history
- Polls for live status while active
- Exposes `placeBid(payload)` with success/error feedback

```ts
const {
  auction, bids, loading, bidsLoading,
  error, bidError, bidSuccess, placingBid,
  placeBid, refresh, clearBidFeedback,
} = useAuctionDetail(auctionId);
```

---

## Environment Variables

No new environment variables are required. The existing variable is used:

| Variable                | Default                      | Description              |
|-------------------------|------------------------------|--------------------------|
| `NEXT_PUBLIC_API_URL`   | `http://localhost:3001/api/v1` | Backend API base URL    |

---

## User Flows

### View Live Auctions
1. Navigate to **Marketplace → Auctions** tab.
2. Active auctions are shown in the **Live Auctions** section with a pulsing indicator.
3. Prices auto-refresh every 15 seconds.

### Place a Bid
1. Click any active auction card to open the detail page.
2. The **Place a Bid** form pre-fills with the current price.
3. Adjust the price (must be ≥ floor price) and quantity (must be ≤ remaining).
4. Submit — success/error feedback is shown inline.
5. On success, the auction data and bid history refresh automatically.

### Error Handling
| Scenario | Handling |
|---|---|
| Auction ended | `bidError` shows "Auction has ended" |
| Bid below floor price | Client-side validation before submit |
| Exceeds remaining quantity | Client-side validation before submit |
| Network / server error | Error message shown in form; no silent failure |
| Auction not found | Error state displayed with retry button |

---

## Testing

Tests are located alongside the source files:

```
src/services/auction.service.test.ts   (12 tests)
src/hooks/useAuction.test.ts           (9 tests)
```

Run them with:

```bash
npx vitest run src/services/auction.service.test.ts src/hooks/useAuction.test.ts
```

Or run the full suite:

```bash
npx vitest run
```

Test coverage includes:
- All service methods: success, API failure, and edge-case error responses
- `useAuctionList`: initial fetch, error state, refresh
- `useAuctionDetail`: initial fetch, bid placement (success + failure),
  feedback clearing, and manual refresh
