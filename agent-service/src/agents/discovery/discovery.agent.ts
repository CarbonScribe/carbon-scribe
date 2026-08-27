import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import {
  checkApproval,
  DISCOVERY_ACTION_TYPES,
} from "../../shared/guardrails/approval-gate.js";
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

// Bounds retries against a still-unimplemented search_marketplace_credits
// tool (tracked separately) so a persistently failing tool call can't loop
// forever.
const MAX_ITERATIONS = 8;

interface ToolCallRecord {
  name: string;
  input: unknown;
}

export async function runDiscoveryAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  const runner = anthropic.beta.messages.toolRunner({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    max_iterations: MAX_ITERATIONS,
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
      "Anthropic declined to complete this discovery request.",
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

// The tool runner already catches an individual tool's run() throwing and
// feeds it back to the model as an is_error tool_result (see
// generateToolResponse in @anthropic-ai/sdk's BetaToolRunner) — the model
// gets a chance to recover or explain the gap in `notes`. An error only
// reaches here for a genuine Anthropic API failure (network, auth, rate
// limit, 5xx) or something outside that per-tool recovery path, so the two
// are distinguished by whether it is an Anthropic.APIError.
function describeRunnerError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    return `Anthropic API error: ${err.message}`;
  }
  return `Discovery agent tool execution failed: ${
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
    agent: "discovery",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status: "failed",
  });

  return {
    agent: "discovery",
    requestId: req.requestId,
    status: "failed",
    output: { error: message },
  };
}
