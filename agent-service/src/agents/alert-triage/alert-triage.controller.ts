import { Router } from "express";
import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { runAlertTriageAgent } from "./alert-triage.agent.js";

export const alertTriageRouter = Router();

// runAlertTriageAgent resolves (never throws) for every expected outcome —
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

alertTriageRouter.post("/run", async (req, res, next) => {
  try {
    const body = req.body as AgentRunRequest;
    const result = await runAlertTriageAgent(body);
    res.status(statusCodeFor(result)).json(result);
  } catch (err) {
    next(err);
  }
});
