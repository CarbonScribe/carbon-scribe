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
  checkApproval,
  DISCOVERY_ACTION_TYPES,
} from "../../shared/guardrails/approval-gate.js";
import { logger } from "../../shared/logging/logger.js";
import type {
  AgentCitation,
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

// Forces the final turn into machine-readable JSON so citations can be
// mapped onto the AgentCitation contract instead of scraped from prose.
const DiscoveryOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      creditId: z.string(),
      justification: z.string(),
    }),
  ),
  citations: z.array(
    z.object({
      source: z.string(),
      reference: z.string(),
    }),
  ),
  notes: z
    .string()
    .optional()
    .describe(
      "Explanation for an empty or partial shortlist, e.g. no credits matched the buyer's criteria or the marketplace search was unavailable.",
    ),
});

const outputFormat = betaZodOutputFormat(DiscoveryOutputSchema);

interface ToolCallRecord {
  name: string;
  input: unknown;
  output: unknown;
}

export async function runDiscoveryAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  const runner = anthropic.beta.messages.toolRunner({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    max_iterations: env.agentMaxIterations,
    system: SYSTEM_PROMPT,
    tools: discoveryTools,
    output_config: { format: outputFormat },
    messages: [
      {
        role: "user",
        content: `Buyer request (JSON):\n${JSON.stringify(req.input, null, 2)}`,
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
          // block.content is either a string or an array of content blocks.
          // Normalise to the raw value so callers see what the tool returned.
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
      "Discovery agent",
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
      `Discovery agent aborted after exceeding its token budget (used ${cumulativeTokens} of ${env.agentMaxTokensPerRun} tokens).`,
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
      "Anthropic declined to complete this discovery request.",
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
      "Discovery agent finished without producing a text response.",
      cumulativeTokens,
    );
  }

  let parsed: z.infer<typeof DiscoveryOutputSchema>;
  try {
    parsed = outputFormat.parse(textBlock.text);
  } catch (err) {
    return failRun(
      req,
      toolCalls,
      `Discovery agent returned output that could not be parsed: ${
        err instanceof Error ? err.message : String(err)
      }`,
      cumulativeTokens,
    );
  }

  const citations: AgentCitation[] = parsed.citations;
  const decision = checkApproval({
    actionType: DISCOVERY_ACTION_TYPES.RECOMMEND_CREDITS,
    payload: { recommendations: parsed.recommendations, citations },
  });
  const status = decision === "auto-approved" ? "drafted" : "needs-approval";

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "discovery",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status,
  });
  logger.info(
    { agent: "discovery", requestId: req.requestId, status, cumulativeTokens },
    "agent run token usage",
  );

  return {
    agent: "discovery",
    requestId: req.requestId,
    status,
    output: {
      recommendations: parsed.recommendations,
      notes: parsed.notes,
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
    agent: "discovery",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status: "failed",
  });
  logger.info(
    {
      agent: "discovery",
      requestId: req.requestId,
      status: "failed",
      cumulativeTokens,
    },
    "agent run token usage",
  );

  return {
    agent: "discovery",
    requestId: req.requestId,
    status: "failed",
    output: { error: message },
    errorCategory: errorInfo?.category,
    retryable: errorInfo?.retryable,
  };
}
