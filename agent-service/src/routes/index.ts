import { Router } from "express";
import { requireInternalAuth } from "../shared/middleware/auth.middleware.js";
import { healthRouter } from "../health/health.controller.js";
import { discoveryRouter } from "../agents/discovery/discovery.controller.js";
import { pddDraftRouter } from "../agents/pdd-draft/pdd-draft.controller.js";
import { complianceReportRouter } from "../agents/compliance-report/compliance-report.controller.js";
import { alertTriageRouter } from "../agents/alert-triage/alert-triage.controller.js";

export const router = Router();

// Liveness/readiness probes (issue #580) — unauthenticated, same as the
// flat /health route this replaces, since these are polled by an
// orchestrator (kubelet, ECS agent), not by an authenticated caller.
router.use("/health", healthRouter);

router.use("/agents/discovery", requireInternalAuth, discoveryRouter);
router.use("/agents/pdd-draft", requireInternalAuth, pddDraftRouter);
router.use(
  "/agents/compliance-report",
  requireInternalAuth,
  complianceReportRouter,
);
router.use("/agents/alert-triage", requireInternalAuth, alertTriageRouter);
