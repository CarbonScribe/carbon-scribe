// Shared request/response contracts for every agent route in this service.
// Individual agents extend these rather than inventing their own shapes, so
// the audit log and guardrail middleware can stay agent-agnostic.

import { z, type ZodType } from "zod";

export type AgentName =
  "discovery" | "pdd-draft" | "compliance-report" | "alert-triage";

const BoundedString = z.string().trim().min(1).max(200);

export const AgentRunRequestSchema = z.object({
  /** Caller-provided idempotency/trace id — propagate into the audit log. */
  requestId: BoundedString,
  /** Identity of the human or system that triggered this run. */
  requestedBy: z.string().trim().min(1).max(200).optional(),
  input: z.unknown(),
});

export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema> & {
  requestedBy: string;
};

export const DiscoveryInputSchema = z
  .object({
    companyId: z.string().trim().min(1).max(200).optional(),
    budget: z.number().finite().nonnegative().optional(),
    sector: z.string().trim().max(200).optional(),
    methodology: z.string().trim().max(200).optional(),
    complianceFramework: z
      .enum(["csrd", "cbam", "corsia", "sbti", "ghg-protocol"])
      .optional(),
    vintage: z.string().trim().max(100).optional(),
    maxPricePerTonne: z.number().finite().nonnegative().optional(),
    coBenefits: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .strict();

export const PddDraftInputSchema = z
  .object({
    activityType: z.string().trim().min(1).max(200),
    country: z.string().trim().min(1).max(100),
    hectares: z.number().finite().nonnegative().optional(),
    landDetails: z.string().trim().max(20_000).optional(),
    targetMethodology: z.string().trim().max(200).optional(),
    documents: z.array(z.string().trim().max(500)).max(100).optional(),
  })
  .strict();

export const ComplianceReportInputSchema = z
  .object({
    companyId: z.string().trim().min(1).max(200),
    framework: z.enum(["csrd", "cbam", "corsia", "sbti", "ghg-protocol"]),
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
  })
  .strict()
  .refine((input) => input.periodEnd > input.periodStart, {
    message: "periodEnd must be after periodStart",
    path: ["periodEnd"],
  });

export const AlertTriageInputSchema = z
  .object({
    alert: z
      .object({
        alertId: z.string().trim().min(1).max(200),
        projectId: z.string().trim().min(1).max(200),
        type: z.string().trim().min(1).max(100).optional(),
        observedAt: z.iso.datetime().optional(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    project: z
      .object({
        projectId: z.string().trim().min(1).max(200),
        country: z.string().trim().max(100).optional(),
      })
      .strict(),
  })
  .strict();

export function agentRunSchema(inputSchema: ZodType) {
  return z
    .object({
      requestId: BoundedString,
      requestedBy: z.string().trim().min(1).max(200).optional(),
      input: inputSchema,
    })
    .strict();
}

export interface AgentRunResult {
  agent: AgentName;
  requestId: string;
  /** Agents in this service draft or recommend — they do not execute
   * financial/on-chain actions. `status` reflects that a human approval
   * step is expected downstream for anything consequential. */
  status: "drafted" | "needs-approval" | "failed";
  output: unknown;
  /** Citations/source records the agent grounded its answer in — required
   * for anything compliance- or portfolio-facing. */
  citations?: AgentCitation[];
  /** Error classification for failed runs — helps callers distinguish
   * transient failures (rate limits, connection errors) from permanent ones. */
  errorCategory?:
    | "rate_limited"
    | "connection_error"
    | "invalid_request"
    | "timeout"
    | "unknown";
  /** Whether the error is retryable — true for rate limits and connection errors. */
  retryable?: boolean;
}

// Single source of truth for a citation's shape (#705) — every agent's own
// output schema imports this instead of redeclaring an identical
// `z.object({ source: z.string(), reference: z.string() })` literal.
export const AgentCitationSchema = z.object({
  source: z.string(),
  reference: z.string(),
});

export type AgentCitation = z.infer<typeof AgentCitationSchema>;
