import { Router } from "express";
import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { runComplianceReportAgent } from "./compliance-report.agent.js";
import { approvalService } from "../../shared/approvals/approval.service.js";
import { validateBody } from "../../shared/middleware/validate-body.js";
import {
  agentRunSchema,
  ComplianceReportInputSchema,
} from "../../shared/types/agent.types.js";

export const complianceReportRouter = Router();

// runComplianceReportAgent resolves (never throws) for every expected
// outcome — including an LLM or tool failure, which comes back as
// status: "failed" with a well-formed body rather than an exception. Map
// that outcome to a status code here instead of letting every case fall
// through to the generic 500 error handler.
function statusCodeFor(result: AgentRunResult): number {
  switch (result.status) {
    case "drafted":
    case "needs-approval":
      return 200;
    case "failed":
      return 502;
  }
}

complianceReportRouter.post(
  "/run",
  validateBody(agentRunSchema(ComplianceReportInputSchema)),
  async (req, res, next) => {
    try {
      const body: AgentRunRequest = req.body;
      // requireInternalAuth verifies who actually called this route — prefer
      // that over whatever the client claims in the body, so the audit trail
      // can't be poisoned by a spoofed requestedBy.
      const requestedBy = req.callingService ?? body.requestedBy ?? "unknown";
      const result = await runComplianceReportAgent({ ...body, requestedBy });
      await approvalService.queue(result, requestedBy, body.input);
      res.status(statusCodeFor(result)).json(result);
    } catch (err) {
      next(err);
    }
  },
);
