import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import {
  ALERT_TRIAGE_ACTION_TYPES,
  checkApproval,
} from "../../shared/guardrails/approval-gate.js";
import type {
  AgentCitation,
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

// Forces the final turn into machine-readable JSON so the triage decision
// is an explicit verdict the caller can branch on, not prose the caller
// has to re-parse.
const AlertTriageOutputSchema = z.object({
  verdict: z.enum(["escalate", "suppress", "needs-more-data"]),
  reasoning: z.string(),
  citations: z.array(
    z.object({
      source: z.string(),
      reference: z.string(),
    }),
  ),
});

const outputFormat = betaZodOutputFormat(AlertTriageOutputSchema);

// Bounds retries against a still-unimplemented get_monitoring_signals tool
// (tracked separately) so a persistently failing tool call can't loop
// forever.
const MAX_ITERATIONS = 8;

interface ToolCallRecord {
  name: string;
  input: unknown;
}

export async function runAlertTriageAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  const runner = anthropic.beta.messages.toolRunner({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    max_iterations: MAX_ITERATIONS,
    system: SYSTEM_PROMPT,
    tools: alertTriageTools,
    output_config: { format: outputFormat },
    messages: [
      {
        role: "user",
        content: `Candidate alert (JSON):\n${JSON.stringify(req.input, null, 2)}`,
      },
    ],
  });

  function extractToolCalls(): ToolCallRecord[] {
    const calls: ToolCallRecord[] = [];
    for (const message of runner.params.messages) {
      if (message.role !== "assistant" || typeof message.content === "string") {
        continue;
      }
      for (const block of message.content) {
        if (block.type === "tool_use") {
          calls.push({ name: block.name, input: block.input });
        }
      }
    }
    return calls;
  }

  let finalMessage: Awaited<typeof runner>;
  try {
    finalMessage = await runner;
  } catch (err) {
    return failRun(req, extractToolCalls(), describeRunnerError(err));
  }

  const toolCalls = extractToolCalls();

  // Refusal-terminated turns may cut a tool_use off mid-input (see
  // BetaToolRunner), so there is no safe partial result to salvage here.
  if (finalMessage.stop_reason === "refusal") {
    return failRun(
      req,
      toolCalls,
      "Anthropic declined to complete this alert-triage request.",
    );
  }

  const textBlock = finalMessage.content.find(
    (
      block,
    ): block is Extract<
      (typeof finalMessage.content)[number],
      { type: "text" }
    > => block.type === "text",
  );
  if (!textBlock) {
    return failRun(
      req,
      toolCalls,
      "Alert-triage agent finished without producing a text response.",
    );
  }

  let parsed: z.infer<typeof AlertTriageOutputSchema>;
  try {
    parsed = outputFormat.parse(textBlock.text);
  } catch (err) {
    return failRun(
      req,
      toolCalls,
      `Alert-triage agent returned output that could not be parsed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  // An escalate verdict feeds project-portal's notification pipeline —
  // that's consequential enough to require human sign-off, so it comes
  // back as "needs-approval" rather than a final "drafted" result. A
  // suppress or needs-more-data verdict doesn't trigger anything on its
  // own, so "drafted" is sufficient there. The verdict-to-action-type
  // mapping and the actual approval decision both live in checkApproval,
  // not here.
  const actionType: string =
    parsed.verdict === "escalate"
      ? ALERT_TRIAGE_ACTION_TYPES.ESCALATE
      : parsed.verdict === "suppress"
        ? ALERT_TRIAGE_ACTION_TYPES.SUPPRESS
        : ALERT_TRIAGE_ACTION_TYPES.NEEDS_MORE_DATA;
  const decision = checkApproval({
    actionType,
    payload: { verdict: parsed.verdict, reasoning: parsed.reasoning },
  });
  const status = decision === "auto-approved" ? "drafted" : "needs-approval";

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "alert-triage",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status,
  });

  const citations: AgentCitation[] = parsed.citations;

  return {
    agent: "alert-triage",
    requestId: req.requestId,
    status,
    output: {
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
    },
    citations,
  };
}

// The tool runner already catches an individual tool's run() throwing and
// feeds it back to the model as an is_error tool_result (see
// generateToolResponse in @anthropic-ai/sdk's BetaToolRunner) — the model
// gets a chance to recover or return a needs-more-data verdict. An error
// only reaches here for a genuine Anthropic API failure (network, auth,
// rate limit, 5xx) or something outside that per-tool recovery path, so
// the two are distinguished by whether it is an Anthropic.APIError.
function describeRunnerError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    return `Anthropic API error: ${err.message}`;
  }
  return `Alert-triage agent tool execution failed: ${
    err instanceof Error ? err.message : String(err)
  }`;
}

async function failRun(
  req: AgentRunRequest,
  toolCalls: ToolCallRecord[],
  message: string,
): Promise<AgentRunResult> {
  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "alert-triage",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status: "failed",
  });

  return {
    agent: "alert-triage",
    requestId: req.requestId,
    status: "failed",
    output: { error: message },
  };
}
