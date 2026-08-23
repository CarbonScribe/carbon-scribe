import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { discoveryTools } from "./discovery.tools.js";

const SYSTEM_PROMPT = `You are the credit-discovery agent for CarbonScribe's corporate marketplace.
Given a buyer's stated goals (budget, sector, co-benefit priorities, compliance framework),
search the marketplace and produce a shortlist of carbon credits with a short justification
for each. Always cite the specific credit records you relied on. Never claim a credit is
"the best" without pointing to the data that supports it — this output feeds a compliance
review, not just a recommendation widget.`;

// TODO: this is a placeholder shape. Once the discovery.tools.ts calls are
// real, run the tool runner and map its final message into AgentRunResult.
export async function runDiscoveryAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  void anthropic;
  void DEFAULT_MODEL;
  void discoveryTools;
  void SYSTEM_PROMPT;

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "discovery",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls: [],
    status: "failed",
  });

  throw new Error("not implemented");
}
