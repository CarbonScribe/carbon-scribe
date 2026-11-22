import { Router } from "express";
import { auditLog } from "./audit-log.service.js";

export const auditRouter = Router();

/**
 * GET /audit/usage/daily (#829)
 * Returns aggregated daily token usage and estimated cost breakdown per agent and model.
 */
auditRouter.get("/usage/daily", async (req, res) => {
  const agent =
    typeof req.query["agent"] === "string" ? req.query["agent"] : undefined;
  const model =
    typeof req.query["model"] === "string" ? req.query["model"] : undefined;

  const usage = await auditLog.getDailyTokenUsage({ agent, model });
  res.json({ usage });
});
