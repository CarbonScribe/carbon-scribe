import { Router } from "express";
import type { AgentRunRequest } from "../../shared/types/agent.types.js";
import { runDiscoveryAgent } from "./discovery.agent.js";

export const discoveryRouter = Router();

discoveryRouter.post("/run", async (req, res, next) => {
  try {
    const body = req.body as AgentRunRequest;
    const result = await runDiscoveryAgent(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
