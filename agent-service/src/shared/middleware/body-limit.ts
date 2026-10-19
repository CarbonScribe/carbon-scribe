// Agent-run request body size limit (#704). express.json() previously ran
// with no explicit `limit` option, silently relying on Express's implicit
// 100kb default — a value nobody here ever reasoned about or wrote a test
// against, and one a future body-parser upgrade (or a different parser
// swapped in later) could silently change out from under this service.
//
// Every agent route's `input` field is interpreted entirely by that
// agent's own code (AgentRunRequest.input: unknown) and, for every agent
// written so far, gets JSON.stringify'd directly into the LLM's first user
// turn (see e.g. pdd-draft.agent.ts's `messages`). So this limit is really
// the ceiling on what a single caller can stuff into model context before
// the Anthropic call is even made, not just an HTTP hygiene concern.
//
// 1 MiB covers every agent's realistic input shape with headroom:
//   - discovery: marketplace search criteria (methodology, price range,
//     country, volume) — a few hundred bytes.
//   - compliance-report: an evidence request (companyId, framework,
//     reporting period) — a few hundred bytes.
//   - alert-triage: a monitoring correlation request (projectId, a time
//     window, and optionally a batch of recent signal readings) — low
//     tens of KB even with a signal batch attached.
//   - pdd-draft: the largest realistic input — a project developer's raw
//     submission, which can include free-text narrative sections and an
//     embedded GeoJSON project boundary. A multi-parcel boundary with
//     hundreds of coordinate pairs plus a few paragraphs of narrative
//     still lands in the tens-to-low-hundreds of KB, well under 1 MiB.
//
// All four routes share this one limit rather than a per-route override:
// none has a demonstrated need for a different ceiling, and one value is
// one less thing to keep in sync as agents are added. Override via
// MAX_REQUEST_BODY_BYTES (see config/env.ts) if a real payload shape ever
// outgrows this.
export const DEFAULT_MAX_REQUEST_BODY_BYTES = 1_048_576; // 1 MiB
