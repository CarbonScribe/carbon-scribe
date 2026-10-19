import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { env } from "../../config/env.js";
import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { classifyAnthropicError, ErrorCategory } from "../../llm/errors.js";
import { runWithTokenBudget } from "../../llm/budget.js";
import {
  auditLog,
  truncateToolOutput,
} from "../../shared/audit/audit-log.service.js";
import {
  ALERT_TRIAGE_ACTION_TYPES,
  checkApproval,
} from "../../shared/guardrails/approval-gate.js";
import { logger } from "../../shared/logging/logger.js";
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

interface ToolCallRecord {
  name: string;
  input: unknown;
  output: unknown;
}

export async function runAlertTriageAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  const runner = anthropic.beta.messages.toolRunner({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    max_iterations: env.agentMaxIterations,
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
    // First pass: collect every tool_result content block from user turns,
    // keyed by the tool_use_id they correspond to.
    const resultsByUseId = new Map<string, unknown>();
    for (const message of runner.params.messages) {
      if (message.role !== "user" || typeof message.content === "string") {
        continue;
      }
      for (const block of message.content) {
        if (block.type === "tool_result") {
          resultsByUseId.set(block.tool_use_id as string, block.content);
        }
      }
    }

    // Second pass: pair each tool_use block with its result.
    const calls: ToolCallRecord[] = [];
    for (const message of runner.params.messages) {
      if (message.role !== "assistant" || typeof message.content === "string") {
        continue;
      }
      for (const block of message.content) {
        if (block.type === "tool_use") {
          const rawOutput = resultsByUseId.get(block.id as string);
          calls.push({
            name: block.name,
            input: block.input,
            output: truncateToolOutput(rawOutput ?? null),
          });
        }
      }
    }
    return calls;
  }

  const budgetResult = await runWithTokenBudget(runner, {
    maxTokensPerRun: env.agentMaxTokensPerRun,
  });
  const { message: finalMessage, cumulativeTokens } = budgetResult;

  if (budgetResult.error) {
    const classified = classifyAnthropicError(
      budgetResult.error,
      "Alert-triage agent",
    );
    return failRun(
      req,
      extractToolCalls(),
      classified.message,
      cumulativeTokens,
      classified,
    );
  }

  if (budgetResult.budgetExceeded) {
    return failRun(
      req,
      extractToolCalls(),
      `Alert-triage agent aborted after exceeding its token budget (used ${cumulativeTokens} of ${env.agentMaxTokensPerRun} tokens).`,
      cumulativeTokens,
    );
  }

  const toolCalls = extractToolCalls();

  // Refusal-terminated turns may cut a tool_use off mid-input (see
  // BetaToolRunner), so there is no safe partial result to salvage here.
  if (!finalMessage || finalMessage.stop_reason === "refusal") {
    return failRun(
      req,
      toolCalls,
      "Anthropic declined to complete this alert-triage request.",
      cumulativeTokens,
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
      cumulativeTokens,
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
      cumulativeTokens,
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
  logger.info(
    {
      agent: "alert-triage",
      requestId: req.requestId,
      status,
      cumulativeTokens,
    },
    "agent run token usage",
  );

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

async function failRun(
  req: AgentRunRequest,
  toolCalls: ToolCallRecord[],
  message: string,
  cumulativeTokens: number,
  errorInfo?: { category: ErrorCategory; retryable: boolean },
): Promise<AgentRunResult> {
  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "alert-triage",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status: "failed",
  });
  logger.info(
    {
      agent: "alert-triage",
      requestId: req.requestId,
      status: "failed",
      cumulativeTokens,
    },
    "agent run token usage",
  );

  return {
    agent: "alert-triage",
    requestId: req.requestId,
    status: "failed",
    output: { error: message },
    errorCategory: errorInfo?.category,
    retryable: errorInfo?.retryable,
  };
}
