import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { complianceReportTools } from "./compliance-report.tools.js";

const SYSTEM_PROMPT = `You are the compliance-report drafting agent for CarbonScribe's corporate platform.
Given a company and a regulatory framework (CSRD, CBAM, CORSIA, SBTi, or GHG Protocol),
assemble retirement/portfolio evidence and draft the report narrative sections. Ground every
claim in the fetched evidence and cite the specific records used. Explicitly flag any gap or
inconsistency that needs human review before this report can be submitted — never paper over
missing data.`;

// TODO: placeholder shape — wire the real tool runner call once
// compliance-report.tools.ts is implemented. This agent's output must
// always come back as status "needs-approval" (see shared/guardrails) —
// no auto-submission to a regulator, ever.
export async function runComplianceReportAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  void anthropic;
  void DEFAULT_MODEL;
  void complianceReportTools;
  void SYSTEM_PROMPT;

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "compliance-report",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls: [],
    status: "failed",
  });

  throw new Error("not implemented");
}
