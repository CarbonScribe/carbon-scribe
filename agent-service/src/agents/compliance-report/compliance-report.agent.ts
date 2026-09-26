import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, DEFAULT_MODEL } from "../../llm/client.js";
import { auditLog } from "../../shared/audit/audit-log.service.js";
import {
  checkApproval,
  COMPLIANCE_REPORT_ACTION_TYPES,
} from "../../shared/guardrails/approval-gate.js";
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

// Bounds retries against a still-unimplemented
// get_company_retirement_evidence tool (tracked separately) so a
// persistently failing tool call can't loop forever.
const MAX_ITERATIONS = 8;

interface ToolCallRecord {
  name: string;
  input: unknown;
}

export async function runComplianceReportAgent(
  req: AgentRunRequest,
): Promise<AgentRunResult> {
  const runner = anthropic.beta.messages.toolRunner({
    model: DEFAULT_MODEL,
    max_tokens: 16000,
    max_iterations: MAX_ITERATIONS,
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
      "Anthropic declined to complete this compliance-report request.",
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

// The tool runner already catches an individual tool's run() throwing and
// feeds it back to the model as an is_error tool_result (see
// generateToolResponse in @anthropic-ai/sdk's BetaToolRunner) — the model
// gets a chance to recover or flag the affected section as a gap. An error
// only reaches here for a genuine Anthropic API failure (network, auth,
// rate limit, 5xx) or something outside that per-tool recovery path, so the
// two are distinguished by whether it is an Anthropic.APIError.
function describeRunnerError(err: unknown): string {
  if (err instanceof Anthropic.APIError) {
    return `Anthropic API error: ${err.message}`;
  }
  return `Compliance-report agent tool execution failed: ${
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
    agent: "compliance-report",
    requestId: req.requestId,
    requestedBy: req.requestedBy,
    toolCalls,
    status: "failed",
  });

  return {
    agent: "compliance-report",
    requestId: req.requestId,
    status: "failed",
    output: { error: message },
  };
}
