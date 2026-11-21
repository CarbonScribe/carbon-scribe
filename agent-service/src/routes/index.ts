import { Router } from "express";
import { requireInternalAuth } from "../shared/middleware/auth.middleware.js";
import { agentRateLimiter } from "../shared/middleware/rate-limit.js";
import { healthRouter } from "../health/health.controller.js";
import { discoveryRouter } from "../agents/discovery/discovery.controller.js";
import { pddDraftRouter } from "../agents/pdd-draft/pdd-draft.controller.js";
import { complianceReportRouter } from "../agents/compliance-report/compliance-report.controller.js";
import { alertTriageRouter } from "../agents/alert-triage/alert-triage.controller.js";
import { approvalsRouter } from "../shared/approvals/approvals.controller.js";
import { openapiRouter } from "../openapi/openapi.controller.js";

export const router = Router();

// OpenAPI spec routes (issue #632) — unauthenticated contract discovery
router.use(openapiRouter);

// Liveness/readiness probes (issue #580) — unauthenticated, same as the
// flat /health route this replaces, since these are polled by an
// orchestrator (kubelet, ECS agent), not by an authenticated caller.
router.use("/health", healthRouter);

router.use(
  "/agents/discovery",
  requireInternalAuth,
  agentRateLimiter("discovery"),
  discoveryRouter,
);
router.use(
  "/agents/pdd-draft",
  requireInternalAuth,
  agentRateLimiter("pdd-draft"),
  pddDraftRouter,
);
router.use(
  "/agents/compliance-report",
  requireInternalAuth,
  agentRateLimiter("compliance-report"),
  complianceReportRouter,
);
router.use(
  "/agents/alert-triage",
  requireInternalAuth,
  agentRateLimiter("alert-triage"),
  alertTriageRouter,
);
router.use("/approvals", requireInternalAuth, approvalsRouter);
