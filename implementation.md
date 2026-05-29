# CarbonScribe Robust Health Checks & Dependency Probes Implementation

This document describes the design, implementation, and operational integration of the production-grade health check probes (Liveness and Readiness) developed for the **CarbonScribe Corporate Platform Backend**.

---

## 🚀 Design Philosophy & Architecture

Standard health checks often only verify that the backend process is running, failing to identify silent dependency outages. To ensure production stability, automated recovery, and orchestration integration (e.g., Kubernetes, ECS), this implementation separates health checks into two distinct probes:

1. **Liveness Probe (`GET /health/liveness`)**: A quick, non-blocking check that confirms the NestJS application process is running and capable of handling incoming event-loop loops.
2. **Readiness Probe (`GET /health/readiness`)**: A comprehensive check verifying the real status and reachability of all external dependencies. It returns `200 OK` only if all critical dependencies are healthy, and `503 Service Unavailable` with details if any dependency is down or degraded.

### ⏱️ Performance & Time Complexity Design

To prevent health checks from causing cascading failures or degrading application throughput under load, the readiness probe is built with the following performance guarantees:

* **Parallel Execution ($O(1)$ Bound Time)**: Rather than executing dependency checks sequentially ($O(N)$), checks are run concurrently using `Promise.all`. The total execution time is bounded by the slowest single service timeout ($O(\max(t_i))$), rather than the sum of all timeouts.
* **Fast Timeouts & Context Cancellation**: Every external request (Database, Redis, Kafka, IPFS, Stellar) is protected by a strict `Promise.race` timeout (2–3 seconds). This guarantees the readiness probe responds quickly, even if a dependency is completely unresponsive.
* **Space Complexity ($O(1)$)**: Checks are ephemeral, executing with no memory leak vectors and utilizing existing shared client connection pools.

---

## 🛠️ Dependency Check Implementations

Every critical dependency check is implemented cleanly within the standalone `HealthService` domain module:

### 1. Database Connectivity Check (Prisma / PostgreSQL)
* **Strategy**: Executes a lightweight query `SELECT 1` to verify the Prisma connection pool and target PostgreSQL database are actively processing queries.
* **Timeout**: 2 seconds.
* **Implementation snippet**:
  ```typescript
  await Promise.race([
    this.prisma.$queryRaw`SELECT 1`,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
  ]);
  ```

### 2. Redis Cache Connectivity Check (ioredis)
* **Strategy**: Fetches the active `ioredis` client and executes an explicit `.ping()` call to verify connection status, rather than relying solely on connection lifecycle flags.
* **Timeout**: 2 seconds.
* **Implementation snippet**:
  ```typescript
  await Promise.race([
    client.ping(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
  ]);
  ```

### 3. Kafka Broker Connection Check (kafkajs)
* **Strategy**: Uses the active `kafkajs` Admin client to fetch topic metadata (`fetchTopicMetadata({ topics: [] })`). If Kafka is explicitly disabled in the configuration (e.g. local-only in dev), it cleanly reports the dependency as `disabled` and does not block.
* **Timeout**: 3 seconds.
* **Implementation snippet**:
  ```typescript
  await Promise.race([
    admin.fetchTopicMetadata({ topics: [] }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
  ]);
  ```

### 4. IPFS & Pinata Gateway Reachability Check (axios)
* **Strategy**: Issues an HTTP GET request to the Pinata gateway authentication test endpoint (`https://api.pinata.cloud/data/testAuthentication`). To avoid failing readiness tests in development or staging where mock credentials are used, any response back from the remote API (including HTTP 401 or 403) is gracefully classified as **reachable** (network connectivity is up).
* **Timeout**: 2 seconds.
* **Implementation snippet**:
  ```typescript
  try {
    await Promise.race([
      axios.get('https://api.pinata.cloud/data/testAuthentication', { headers, timeout: 2000 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);
  } catch (err) {
    if (err.response) return { status: 'healthy', details: `Reachable (HTTP Status: ${err.response.status})` };
    throw err;
  }
  ```

### 5. Stellar horizon & Soroban RPC Connection Check (Stellar SDK)
* **Strategy**: Leverages the `rpc.Server` connection in `SorobanService` to retrieve the latest ledger sequence (`rpcClient.getLatestLedger()`). This verifies live network reachability and RPC server responsiveness.
* **Timeout**: 2 seconds.
* **Implementation snippet**:
  ```typescript
  await Promise.race([
    rpcClient.getLatestLedger(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
  ]);
  ```

---

## 📂 Implementation Code Reference

The system has been fully integrated into the existing modular codebase across the following paths:

* **Service Logic**: [`src/health/health.service.ts`](file:///home/hillaryeke/carbon/carbon-scribe/corporate-platform/corporate-platform-backend/src/health/health.service.ts)
* **HTTP Controller Routing**: [`src/health/health.controller.ts`](file:///home/hillaryeke/carbon/carbon-scribe/corporate-platform/corporate-platform-backend/src/health/health.controller.ts)
* **NestJS Module Setup**: [`src/health/health.module.ts`](file:///home/hillaryeke/carbon/carbon-scribe/corporate-platform/corporate-platform-backend/src/health/health.module.ts)
* **System Integration**: Registered within the main [`src/app.module.ts`](file:///home/hillaryeke/carbon/carbon-scribe/corporate-platform/corporate-platform-backend/src/app.module.ts) import list.
* **Unit and Integration Specs**:
  * [`src/health/health.service.spec.ts`](file:///home/hillaryeke/carbon/carbon-scribe/corporate-platform/corporate-platform-backend/src/health/health.service.spec.ts)
  * [`src/health/health.controller.spec.ts`](file:///home/hillaryeke/carbon/carbon-scribe/corporate-platform/corporate-platform-backend/src/health/health.controller.spec.ts)

---

## 📊 Probe Response Schemas

### 🟢 1. Liveness Probe Response (`GET /health/liveness`)
* **HTTP Status**: `200 OK`
* **JSON Payload**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-05-26T19:00:00.000Z",
    "service": "corporate-platform-backend",
    "liveness": "up"
  }
  ```

### 🟢 2. Readiness Probe Response - Healthy (`GET /health/readiness`)
* **HTTP Status**: `200 OK`
* **JSON Payload**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-05-26T19:00:02.000Z",
    "version": "0.0.1",
    "uptimeSeconds": 120,
    "checks": {
      "database": {
        "status": "healthy",
        "latencyMs": 14
      },
      "redis": {
        "status": "healthy",
        "latencyMs": 8
      },
      "kafka": {
        "status": "healthy",
        "latencyMs": 45
      },
      "ipfs": {
        "status": "healthy",
        "latencyMs": 110,
        "details": "Reachable (HTTP Status: 401)"
      },
      "stellar": {
        "status": "healthy",
        "latencyMs": 95
      }
    }
  }
  ```

### 🔴 3. Readiness Probe Response - Unhealthy (`GET /health/readiness`)
* **HTTP Status**: `503 Service Unavailable`
* **JSON Payload**:
  ```json
  {
    "status": "unhealthy",
    "timestamp": "2026-05-26T19:01:10.000Z",
    "version": "0.0.1",
    "uptimeSeconds": 188,
    "checks": {
      "database": {
        "status": "unhealthy",
        "error": "Database check timed out"
      },
      "redis": {
        "status": "healthy",
        "latencyMs": 7
      },
      "kafka": {
        "status": "healthy",
        "latencyMs": 32
      },
      "ipfs": {
        "status": "healthy",
        "latencyMs": 89,
        "details": "Reachable (HTTP Status: 401)"
      },
      "stellar": {
        "status": "unhealthy",
        "error": "Stellar RPC request timed out"
      }
    }
  }
  ```

---

## ☸️ Orchestration Integration (e.g., Kubernetes deployment)

Expose these endpoints directly to orchestrators to automate traffic routing and recovery actions:

```yaml
livenessProbe:
  httpGet:
    path: /health/liveness
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /health/readiness
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 15
  timeoutSeconds: 5
  failureThreshold: 3
```
