// Shared request/response contracts for every agent route in this service.
// Individual agents extend these rather than inventing their own shapes, so
// the audit log and guardrail middleware can stay agent-agnostic.

import { z } from "zod";

export type AgentName =
  "discovery" | "pdd-draft" | "compliance-report" | "alert-triage";

export const AgentRunRequestSchema = z.object({
  /** Caller-provided idempotency/trace id — propagate into the audit log. */
  requestId: z.string().min(1, "requestId is required").max(256),
  /** Identity of the human or system that triggered this run. */
  requestedBy: z.string().min(1).max(256).default("anonymous"),
  input: z.unknown(),
});

export type AgentRunRequest = z.infer<typeof AgentRunRequestSchema>;

export const DiscoveryRunInputSchema = z
  .object({
    companyId: z.string().max(256).optional(),
    budget: z.number().positive().max(1e12).optional(),
    sector: z.string().max(256).optional(),
    methodology: z.string().max(256).optional(),
    complianceFramework: z.string().max(64).optional(),
    vintage: z.string().max(64).optional(),
    maxPricePerTonne: z.number().positive().max(1e6).optional(),
    coBenefits: z.array(z.string().max(128)).max(50).optional(),
  })
  .passthrough();

export type DiscoveryRunInput = z.infer<typeof DiscoveryRunInputSchema>;

export const DiscoveryRunRequestSchema = AgentRunRequestSchema.extend({
  input: DiscoveryRunInputSchema,
});
export type DiscoveryRunRequest = z.infer<typeof DiscoveryRunRequestSchema>;

export const PddDraftRunInputSchema = z
  .object({
    activityType: z.string().max(256).optional(),
    country: z.string().max(128).optional(),
    hectares: z.number().positive().max(1e9).optional(),
    landDetails: z.string().max(20000).optional(),
    targetMethodology: z.string().max(256).optional(),
  })
  .passthrough();

export type PddDraftRunInput = z.infer<typeof PddDraftRunInputSchema>;

export const PddDraftRunRequestSchema = AgentRunRequestSchema.extend({
  input: PddDraftRunInputSchema,
});
export type PddDraftRunRequest = z.infer<typeof PddDraftRunRequestSchema>;

export const ComplianceReportRunInputSchema = z
  .object({
    companyId: z.string().max(256).optional(),
    framework: z.string().max(64).optional(),
    periodStart: z.string().max(64).optional(),
    periodEnd: z.string().max(64).optional(),
  })
  .passthrough();

export type ComplianceReportRunInput = z.infer<
  typeof ComplianceReportRunInputSchema
>;

export const ComplianceReportRunRequestSchema = AgentRunRequestSchema.extend({
  input: ComplianceReportRunInputSchema,
});
export type ComplianceReportRunRequest = z.infer<
  typeof ComplianceReportRunRequestSchema
>;

export const AlertTriageRunInputSchema = z
  .object({
    projectId: z.string().max(256).optional(),
    alertId: z.string().max(256).optional(),
    ndviDropPercent: z.number().optional(),
    sensorReadings: z.record(z.string(), z.unknown()).optional(),
    weatherContext: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type AlertTriageRunInput = z.infer<typeof AlertTriageRunInputSchema>;

export const AlertTriageRunRequestSchema = AgentRunRequestSchema.extend({
  input: AlertTriageRunInputSchema,
});
export type AlertTriageRunRequest = z.infer<typeof AlertTriageRunRequestSchema>;

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
    "rate_limited" | "connection_error" | "invalid_request" | "unknown";
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
