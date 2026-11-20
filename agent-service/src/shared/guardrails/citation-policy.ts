// Shared citation-requirement guardrail (#705). AgentRunResult.citations'
// doc comment ("required for anything compliance- or portfolio-facing")
// was previously just a comment — nothing checked it, so a drafted or
// needs-approval result with zero citations passed through silently. This
// is a distinct concern from checkApproval (approval-gate.ts), which only
// ever looks at actionType; it runs *after* that decision, as a second,
// independent check on the same result, not a third disposition.
//
// A result that fails this check is turned into a "failed" AgentRunResult
// by the calling agent's own failRun helper — never thrown past the
// agent's own boundary — consistent with every agent in this service
// resolving rather than throwing for every expected outcome (see e.g.
// discovery.agent.ts's budget/parse/refusal handling, which follows the
// same try/catch-at-the-call-site shape this is meant to slot into).

import type { AgentCitation, AgentRunResult } from "../types/agent.types.js";

export class MissingCitationsError extends Error {
  constructor(status: "drafted" | "needs-approval") {
    super(
      `Agent returned a ${status} result with no citations — a drafted or needs-approval result must cite the data it's grounded in.`,
    );
  }
}

export interface CitationCheckOptions {
  /**
   * True when this specific result is a genuinely citation-free outcome —
   * the agent produced no substantive output to ground a citation in
   * (e.g. discovery's empty shortlist, a drafting agent that completed
   * zero sections, or alert-triage's non-escalating suppress/
   * needs-more-data verdicts, none of which feed a downstream action).
   * Defaults to false. Each call site derives this from its own parsed
   * output, not from this function — only the agent knows what "nothing
   * substantive" means for its own schema.
   */
  allowEmpty?: boolean;
}

/**
 * Throws MissingCitationsError if `status` is "drafted" or
 * "needs-approval" and `citations` is empty, unless `options.allowEmpty`
 * is true. Call this after checkApproval has produced `status` and
 * before constructing the AgentRunResult to return — a "failed" status is
 * never passed in here, since a failed run has nothing to cite in the
 * first place.
 */
export function assertCitationsForStatus(
  status: Extract<AgentRunResult["status"], "drafted" | "needs-approval">,
  citations: AgentCitation[],
  options: CitationCheckOptions = {},
): void {
  if (citations.length > 0 || options.allowEmpty) {
    return;
  }
  throw new MissingCitationsError(status);
}
