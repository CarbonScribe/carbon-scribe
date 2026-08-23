import { Router } from "express";
import type { AgentRunRequest } from "../../shared/types/agent.types.js";
import { runAlertTriageAgent } from "./alert-triage.agent.js";

export const alertTriageRouter = Router();

alertTriageRouter.post("/run", async (req, res, next) => {
  try {
    const body = req.body as AgentRunRequest;
    const result = await runAlertTriageAgent(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
