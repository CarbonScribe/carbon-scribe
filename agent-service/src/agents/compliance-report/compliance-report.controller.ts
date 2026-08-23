import { Router } from "express";
import type { AgentRunRequest } from "../../shared/types/agent.types.js";
import { runComplianceReportAgent } from "./compliance-report.agent.js";

export const complianceReportRouter = Router();

complianceReportRouter.post("/run", async (req, res, next) => {
  try {
    const body = req.body as AgentRunRequest;
    const result = await runComplianceReportAgent(body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
