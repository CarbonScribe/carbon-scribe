import { Router } from "express";
import { requireInternalAuth } from "../shared/middleware/auth.middleware.js";
import { discoveryRouter } from "../agents/discovery/discovery.controller.js";
import { pddDraftRouter } from "../agents/pdd-draft/pdd-draft.controller.js";
import { complianceReportRouter } from "../agents/compliance-report/compliance-report.controller.js";
import { alertTriageRouter } from "../agents/alert-triage/alert-triage.controller.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/agents/discovery", requireInternalAuth, discoveryRouter);
router.use("/agents/pdd-draft", requireInternalAuth, pddDraftRouter);
router.use(
  "/agents/compliance-report",
  requireInternalAuth,
  complianceReportRouter,
);
router.use("/agents/alert-triage", requireInternalAuth, alertTriageRouter);
