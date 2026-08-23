import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { alertTriageTools } from "./alert-triage.tools.js";

const SYSTEM_PROMPT = `You are the alert-triage agent for CarbonScribe's project monitoring pipeline.
Given a candidate deforestation/anomaly alert, correlate satellite NDVI data, IoT sensor
readings, and weather context to decide whether this is a genuine event, seasonal variation,
or a sensor fault. Only recommend escalating to project-portal's notification pipeline when
the correlated evidence supports it — the goal is cutting false-positive alert fatigue, not
adding a second alarm on top of the existing rule-based one.`;

// TODO: placeholder shape — wire the real tool runner call once
// alert-triage.tools.ts is implemented.
export async function runAlertTriageAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  void anthropic;
  void DEFAULT_MODEL;
  void alertTriageTools;
  void SYSTEM_PROMPT;

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "alert-triage",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls: [],
    status: "failed",
  });

  throw new Error("not implemented");
}
