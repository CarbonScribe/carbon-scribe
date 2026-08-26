import { Router } from "express";
import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { runPddDraftAgent } from "./pdd-draft.agent.js";

export const pddDraftRouter = Router();

// runPddDraftAgent resolves (never throws) for every expected outcome —
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

pddDraftRouter.post("/run", async (req, res, next) => {
  try {
    const body = req.body as AgentRunRequest;
    const result = await runPddDraftAgent(body);
    res.status(statusCodeFor(result)).json(result);
  } catch (err) {
    next(err);
  }
});
