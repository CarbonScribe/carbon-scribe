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
  COMPLIANCE_REPORT_ACTION_TYPES,
} from "../../shared/guardrails/approval-gate.js";
import { logger } from "../../shared/logging/logger.js";
import type {
  AgentCitation,
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

// This agent's output must always come back as status "needs-approval" (see
// shared/guardrails) — no auto-submission to a regulator, ever. That is
// enforced below in code, not by anything the model returns, so the schema
// carries no status field of its own to hard-code around.
const ComplianceReportOutputSchema = z.object({
  framework: z
    .enum(["csrd", "cbam", "corsia", "sbti", "ghg-protocol"])
    .optional(),
  sections: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    }),
  ),
  gaps: z
    .array(
      z.object({
        description: z.string(),
      }),
    )
    .describe(
      "Data gaps or inconsistencies that need human review before this report can be submitted.",
    ),
  citations: z.array(
    z.object({
      source: z.string(),
      reference: z.string(),
    }),
  ),
});

const outputFormat = betaZodOutputFormat(ComplianceReportOutputSchema);

interface ToolCallRecord {
  name: string;
  input: unknown;
  output: unknown;
}

export async function runComplianceReportAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  const runner = anthropic.beta.messages.toolRunner({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    max_iterations: env.agentMaxIterations,
    system: SYSTEM_PROMPT,
    tools: complianceReportTools,
    output_config: { format: outputFormat },
    messages: [
      {
        role: "user",
        content: `Compliance report request (JSON):\n${JSON.stringify(req.input, null, 2)}`,
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
      "Compliance-report agent",
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
      `Compliance-report agent aborted after exceeding its token budget (used ${cumulativeTokens} of ${env.agentMaxTokensPerRun} tokens).`,
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
      "Anthropic declined to complete this compliance-report request.",
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
      "Compliance-report agent finished without producing a text response.",
      cumulativeTokens,
    );
  }

  let parsed: z.infer<typeof ComplianceReportOutputSchema>;
  try {
    parsed = outputFormat.parse(textBlock.text);
  } catch (err) {
    return failRun(
      req,
      toolCalls,
      `Compliance-report agent returned output that could not be parsed: ${
        err instanceof Error ? err.message : String(err)
      }`,
      cumulativeTokens,
    );
  }

  const citations: AgentCitation[] = parsed.citations;

  // checkApproval's blocklist guarantees DRAFT_REPORT can never resolve to
  // "auto-approved" (see shared/guardrails/approval-gate.ts and its
  // dedicated test) — a compliance report always requires human sign-off
  // before submission, regardless of how complete or confident the draft
  // looks. `status` below is therefore always "needs-approval" in
  // practice; it's still derived from checkApproval rather than
  // hard-coded so the guarantee lives in one place.
  const decision = checkApproval({
    actionType: COMPLIANCE_REPORT_ACTION_TYPES.DRAFT_REPORT,
    payload: {
      framework: parsed.framework,
      sections: parsed.sections,
      gaps: parsed.gaps,
    },
  });
  const status = decision === "auto-approved" ? "drafted" : "needs-approval";

  await auditLog.record({
    timestamp: new Date().toISOString(),
    agent: "compliance-report",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status,
  });
  logger.info(
    {
      agent: "compliance-report",
      requestId: req.requestId,
      status,
      cumulativeTokens,
    },
    "agent run token usage",
  );

  return {
    agent: "compliance-report",
    requestId: req.requestId,
    status,
    output: {
      framework: parsed.framework,
      sections: parsed.sections,
      gaps: parsed.gaps,
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
    agent: "compliance-report",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status: "failed",
  });
  logger.info(
    {
      agent: "compliance-report",
      requestId: req.requestId,
      status: "failed",
      cumulativeTokens,
    },
    "agent run token usage",
  );

  return {
    agent: "compliance-report",
    requestId: req.requestId,
    status: "failed",
    output: { error: message },
    errorCategory: errorInfo?.category,
    retryable: errorInfo?.retryable,
  };
}
