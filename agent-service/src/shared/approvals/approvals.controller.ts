import { Router } from "express";
import { env } from "../../config/env.js";
import {
  ApprovalConflictError,
  ApprovalNotFoundError,
  approvalService,
} from "./approval.service.js";

export const approvalsRouter = Router();

approvalsRouter.use((req, res, next) => {
  if (
    !req.callingService ||
    !env.approvalReviewerServices.includes(req.callingService)
  ) {
    res.status(403).json({ error: "approval permission required" });
    return;
  }
  next();
});

approvalsRouter.get("/", async (_req, res, next) => {
  try {
    res.json({ approvals: await approvalService.listPending() });
  } catch (err) {
    next(err);
  }
});

for (const decision of ["approve", "reject"] as const) {
  approvalsRouter.post(`/:requestId/${decision}`, async (req, res, next) => {
    // reviewerId is an upstream service assertion, not a claim verified by this JWT.
    const reviewerId = req.body?.reviewerId;
    if (typeof reviewerId !== "string" || reviewerId.trim().length === 0) {
      res.status(400).json({ error: "reviewerId is required" });
      return;
    }

    try {
      const approval = await approvalService.decide(
        req.params.requestId,
        decision === "approve" ? "approved" : "rejected",
        reviewerId.trim(),
        req.callingService!,
      );
      res.json({ approval });
    } catch (err) {
      if (err instanceof ApprovalNotFoundError) {
        res.status(404).json({ error: err.message });
        return;
      }
      if (err instanceof ApprovalConflictError) {
        res.status(409).json({ error: err.message });
        return;
      }
      next(err);
    }
  });
}
