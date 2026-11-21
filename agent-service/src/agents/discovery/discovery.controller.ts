import { Router } from "express";
import {
  type AgentRunResult,
  DiscoveryRunRequestSchema,
  type DiscoveryRunRequest,
} from "../../shared/types/agent.types.js";
import { validateBody } from "../../shared/middleware/validate-body.js";
import { runDiscoveryAgent } from "./discovery.agent.js";
import { approvalService } from "../../shared/approvals/approval.service.js";

export const discoveryRouter = Router();

// runDiscoveryAgent resolves (never throws) for every expected outcome —
// including an LLM or tool failure, which comes back as status: "failed"
// with a well-formed body rather than an exception. Map that outcome to a
// status code here instead of letting every case fall through to the
// generic 500 error handler.
function statusCodeFor(result: AgentRunResult): number {
  switch (result.status) {
    case "drafted":
    case "needs-approval":
      return 200;
    case "failed":
      return 502;
  }
}

discoveryRouter.post(
  "/run",
  validateBody(DiscoveryRunRequestSchema),
  async (req, res, next) => {
    try {
      const body: DiscoveryRunRequest = req.body;
      // requireInternalAuth verifies who actually called this route — prefer
      // that over whatever the client claims in the body, so the audit trail
      // can't be poisoned by a spoofed requestedBy.
      const requestedBy = req.callingService ?? body.requestedBy ?? "anonymous";
      const result = await runDiscoveryAgent({ ...body, requestedBy });
      await approvalService.queue(result, requestedBy, body.input);
      res.status(statusCodeFor(result)).json(result);
    } catch (err) {
      next(err);
    }
  },
);
