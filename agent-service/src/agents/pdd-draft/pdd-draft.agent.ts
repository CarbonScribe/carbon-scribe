import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { pddDraftTools } from "./pdd-draft.tools.js";

const SYSTEM_PROMPT = `You are the PDD (Project Design Document) drafting agent for CarbonScribe.
Given a project developer's raw submission (land details, activity type, target methodology),
match it to the correct methodology, identify missing required documentation, and draft the
PDD sections you have enough grounded data for. Flag any section you cannot complete rather
than inventing figures — this document supports carbon credit issuance.`;

// TODO: placeholder shape — wire the real tool runner call once
// pdd-draft.tools.ts is implemented.
export async function runPddDraftAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  void anthropic;
  void DEFAULT_MODEL;
  void pddDraftTools;
  void SYSTEM_PROMPT;

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "pdd-draft",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls: [],
    status: "failed",
  });

  throw new Error("not implemented");
}
