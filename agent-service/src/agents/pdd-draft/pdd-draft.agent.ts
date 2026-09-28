import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { classifyAnthropicError, ErrorCategory } from "../../llm/errors.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import {
  checkApproval,
  PDD_DRAFT_ACTION_TYPES,
} from "../../shared/guardrails/approval-gate.js";
import type {
  AgentCitation,
  AgentRunRequest,
  AgentRunResult,
} from "../../shared/types/agent.types.js";
import { pddDraftTools } from "./pdd-draft.tools.js";

const SYSTEM_PROMPT = `You are the PDD (Project Design Document) drafting agent for CarbonScribe.
Given a project developer's raw submission (land details, activity type, target methodology),
match it to the correct methodology, identify missing required documentation, and draft the
PDD sections you have enough grounded data for. Flag any section you cannot complete rather
than inventing figures — this document supports carbon credit issuance.`;

// Forces the final turn into machine-readable JSON so drafted sections are
// kept structurally separate from ones the agent explicitly refused to
// invent data for — the whole point of the "flag, don't fabricate" rule in
// the prompt above.
const PddOutputSchema = z.object({
  methodology: z
    .string()
    .optional()
    .describe("The matched methodology, if one could be determined."),
  sections: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    }),
  ),
  incompleteSections: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
    }),
  ),
  citations: z.array(
    z.object({
      source: z.string(),
      reference: z.string(),
    }),
  ),
});

const outputFormat = betaZodOutputFormat(PddOutputSchema);

// Bounds retries against a still-unimplemented match_methodology tool
// (tracked separately) so a persistently failing tool call can't loop
// forever.
const MAX_ITERATIONS = 8;

interface ToolCallRecord {
  name: string;
  input: unknown;
}

export async function runPddDraftAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  const runner = anthropic.beta.messages.toolRunner({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    max_iterations: MAX_ITERATIONS,
    system: SYSTEM_PROMPT,
    tools: pddDraftTools,
    output_config: { format: outputFormat },
    messages: [
      {
        role: "user",
        content: `Project developer submission (JSON):\n${JSON.stringify(req.input, null, 2)}`,
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
    const classified = classifyAnthropicError(err, "PDD drafting agent");
    return failRun(req, extractToolCalls(), classified.message, classified);
  }

  const toolCalls = extractToolCalls();

  // Refusal-terminated turns may cut a tool_use off mid-input (see
  // BetaToolRunner), so there is no safe partial result to salvage here.
  if (finalMessage.stop_reason === "refusal") {
    return failRun(
      req,
      toolCalls,
      "Anthropic declined to complete this PDD drafting request.",
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
      "PDD drafting agent finished without producing a text response.",
    );
  }

  let parsed: z.infer<typeof PddOutputSchema>;
  try {
    parsed = outputFormat.parse(textBlock.text);
  } catch (err) {
    return failRun(
      req,
      toolCalls,
      `PDD drafting agent returned output that could not be parsed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const citations: AgentCitation[] = parsed.citations;
  const decision = checkApproval({
    actionType: PDD_DRAFT_ACTION_TYPES.DRAFT_SECTIONS,
    payload: {
      sections: parsed.sections,
      incompleteSections: parsed.incompleteSections,
    },
  });
  const status = decision === "auto-approved" ? "drafted" : "needs-approval";

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "pdd-draft",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status,
  });

  return {
    agent: "pdd-draft",
    requestId: req.requestId,
    status,
    output: {
      methodology: parsed.methodology,
      sections: parsed.sections,
      incompleteSections: parsed.incompleteSections,
    },
    citations,
  };
}

async function failRun(
  req: AgentRunRequest,
  toolCalls: ToolCallRecord[],
  message: string,
  errorInfo?: { category: ErrorCategory; retryable: boolean },
): Promise<AgentRunResult> {
  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "pdd-draft",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status: "failed",
  });

  return {
    agent: "pdd-draft",
    requestId: req.requestId,
    status: "failed",
    output: { error: message },
    errorCategory: errorInfo?.category,
    retryable: errorInfo?.retryable,
  };
}
