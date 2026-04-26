# Retirement Verification Integration — Testing Guide

## Testnet Testing

The retirement verification service connects to the **Soroban Retirement Tracker contract** on Stellar testnet to validate on-chain retirement status. Follow these steps to test end-to-end:

### 1. Prerequisites

- A funded Stellar testnet account with secret key
- The `SOROBAN_RPC_URL` pointing to the testnet RPC endpoint
- The `RETIREMENT_TRACKER_CONTRACT_ID` set to the deployed testnet contract address
- Set `STELLAR_SECRET_KEY` in `.env` for on-chain transaction signing, or leave it blank to use simulation mode

### 2. Environment Configuration

```env
# .env
STELLAR_NETWORK=testnet
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
RETIREMENT_TRACKER_CONTRACT_ID=CCDCE6N7Q27TZW6Z6W3DPDCNOGHWFSOQUQPSRRZIY7AEHNOYZMNFDFVU
CARBON_ASSET_CONTRACT_ID=CAW7LUESK5RWH75W7IL64HYREFM5CPSFASBVVPVO2XOBC6AKHW4WJ6TM
```

### 3. Endpoints to Test

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/compliance/verify-retirement` | Batch verify retirement status for token IDs |
| `GET` | `/api/v1/compliance/retirement-status/:tokenId` | Check single token retirement status |
| `POST` | `/api/v1/compliance/double-claim-check` | Assess double-claim risk for tokens under a framework |
| `POST` | `/api/v1/compliance/validate-tokens` | Validate tokens for specific compliance framework use |
| `GET` | `/api/v1/compliance/verification-history` | Query audit trail of verification calls |
| `POST` | `/api/v1/csrd/verify-offsets` | CSRD-specific offset verification |
| `POST` | `/api/v1/ghg/verify-offsets` | GHG Protocol-specific offset verification |
| `POST` | `/api/v1/corsia/credits/validate` | CORSIA credit validation with retirement verification |

### 4. Sample Requests

#### Verify retirement (batch)

```bash
curl -X POST http://localhost:4000/api/v1/compliance/verify-retirement \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokens": [
      { "tokenId": "<credit-id>" }
    ],
    "framework": "CORSIA"
  }'
```

#### Check single token status

```bash
curl -X GET "http://localhost:4000/api/v1/compliance/retirement-status/<tokenId>?framework=CORSIA" \
  -H "Authorization: Bearer <JWT>"
```

#### Double-claim risk check

```bash
curl -X POST http://localhost:4000/api/v1/compliance/double-claim-check \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIds": ["<token-1>", "<token-2>"],
    "framework": "GHG"
  }'
```

#### Verification history (audit trail)

```bash
curl -X GET "http://localhost:4000/api/v1/compliance/verification-history?limit=20&offset=0" \
  -H "Authorization: Bearer <JWT>"
```

### 5. Simulation Mode

When `STELLAR_SECRET_KEY` is not set, the `SorobanService` operates in **simulation mode**: contract calls are simulated (not submitted on-chain) and results are stored with status `CONFIRMED` and a `sim_` prefixed transaction hash. This is sufficient for integration testing against testnet RPC.

### 6. Running Unit Tests

```bash
# Retirement verification service
npx jest --testPathPattern="retirement-verification.service.spec"

# Compliance controller (all verification endpoints)
npx jest --testPathPattern="compliance.controller.spec"

# CSRD offset verification
npx jest --testPathPattern="csrd.service.spec"

# GHG offset verification
npx jest --testPathPattern="ghg-protocol.service.spec"

# CORSIA credit validation
npx jest --testPathPattern="corsia.service.spec"

# Full suite
npx jest --no-coverage
```

### 7. Swagger API Docs

After starting the server, navigate to:

```
http://localhost:4000/api/docs
```

This provides an interactive OpenAPI/Swagger UI with all verification endpoints documented.