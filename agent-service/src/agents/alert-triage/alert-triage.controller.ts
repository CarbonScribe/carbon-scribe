import { Router } from "express";
import type { AgentRunRequest } from "../../shared/types/agent.types.js";
import { runAlertTriageAgent } from "./alert-triage.agent.js";

export const alertTriageRouter = Router();

alertTriageRouter.post("/run", async (req, res, next) => {
  try {
    const body = req.body as AgentRunRequest;
    // requireInternalAuth verifies who actually called this route — prefer
    // that over whatever the client claims in the body, so the audit trail
    // can't be poisoned by a spoofed requestedBy.
    const requestedBy = req.callingService ?? body.requestedBy;
    const result = await runAlertTriageAgent({ ...body, requestedBy });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
