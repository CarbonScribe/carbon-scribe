import { Router } from "express";
import { getReadiness } from "./health.service.js";

export const healthRouter = Router();

/**
 * Liveness probe — GET /health/liveness
 *
 * Confirms only that the Express process is running and can handle a
 * request; never touches Anthropic or either upstream client, so it can't
 * be dragged down by a downstream outage. Always 200.
 *
 * Kubernetes wiring:
 *   livenessProbe:
 *     httpGet: { path: /health/liveness, port: 4500 }
 *     initialDelaySeconds: 15
 *     periodSeconds: 10
 */
healthRouter.get("/liveness", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "agent-service",
    liveness: "up",
  });
});

/**
 * Readiness probe — GET /health/readiness
 *
 * Checks the Anthropic API, corporatePlatformClient, and projectPortalClient
 * in parallel (see health.service.ts for per-check timeouts). 200 only if
 * all three are healthy; 503 with per-dependency detail otherwise, so an
 * orchestrator stops routing traffic to an instance that can't actually
 * complete an agent run.
 *
 * Kubernetes wiring:
 *   readinessProbe:
 *     httpGet: { path: /health/readiness, port: 4500 }
 *     initialDelaySeconds: 30
 *     periodSeconds: 15
 *     timeoutSeconds: 5
 *     failureThreshold: 3
 */
healthRouter.get("/readiness", async (_req, res) => {
  const result = await getReadiness();
  res.status(result.status === "healthy" ? 200 : 503).json(result);
});
