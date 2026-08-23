import { Router } from "express";
import type { AgentRunRequest } from "../../shared/types/agent.types.js";
import { runPddDraftAgent } from "./pdd-draft.agent.js";

export const pddDraftRouter = Router();

pddDraftRouter.post("/run", async (req, res, next) => {
  try {
    const body = req.body as AgentRunRequest;
    const result = await runPddDraftAgent(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
