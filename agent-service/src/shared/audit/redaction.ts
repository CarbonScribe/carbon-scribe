// Field-level redaction for agent_audit_log (#702).
//
// A tool call's `input`/`output` is whatever arguments the model passed or
// whatever a corporate-platform/project-portal client call returned —
// unstructured as far as this service is concerned, and never guaranteed
// to be free of a company's financial position or other sensitive detail.
// redactSensitiveFields() is a generic deep pass over known-sensitive key
// names (not a per-tool allow/deny list), so it applies uniformly no
// matter which of the four agents, or which tool, produced the entry, and
// keeps working for a tool nobody has written yet.
//
// This module only decides WHAT counts as sensitive and how to redact it.
// Callers (AuditLogService.record()) decide WHEN to call it — see that
// file for why redaction happens once, at write time, rather than on read.

export const REDACTED = "[REDACTED]";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Field names considered sensitive by exact match, after normalizeKey (so
 * "totalValue", "total_value", and "TOTAL-VALUE" are all the same entry
 * here). Exact match, not suffix match, is deliberate for this group: it's
 * what keeps a generic field like a marketplace listing's "price" visible
 * (public product data, not a company's own financial position) while
 * still catching the specific portfolio-valuation fields below.
 *
 * Grouped by why each one is here. When a new tool's input or output
 * schema gains a field that shouldn't reach the audit log in plaintext,
 * add its name to the appropriate group below — or to
 * SENSITIVE_SUFFIX_TOKENS if it's a generic term likely to appear with a
 * qualifier prefix (ownerEmail, billingAddress, etc.).
 */
const EXACT_SENSITIVE_FIELD_NAMES = new Set(
  [
    // --- Company financial position (corporate-platform's portfolio data —
    // clients/corporate-platform.client.ts's PortfolioSchema, surfaced via
    // the discovery and compliance-report agents' getPortfolio-backed
    // tools). A company's own holdings, valuations, and risk posture are
    // commercially sensitive, independent of any single tool call's
    // intent.
    "totalRetired",
    "currentBalance",
    "totalValue",
    "avgPricePerTon",
    "riskRating",
    "currentValue",
    "quantity", // position size — reveals how much of a holding a company has.
    "maxPricePerTonne", // a buyer's own budget ceiling (discovery's search input).

    // --- Generic financial figures. Not produced by any tool today, but
    // an obvious name for one that gets written in the future.
    "balance",
    "revenue",
    "netWorth",
    "income",
    "salary",
    "bankAccountNumber",
    "routingNumber",
    "creditCardNumber",
    "cvv",

    // --- Generic PII, as a full word rather than a suffix (see
    // SENSITIVE_SUFFIX_TOKENS for the "ownerEmail"-shaped version of these).
    "ssn",
    "socialSecurityNumber",
    "taxId",
    "dateOfBirth",

    // --- Secrets/credentials, in case a tool ever echoes one back
    // (e.g. in an error message's structured detail).
    "password",
    "secret",
    "apiKey",
    "accessToken",
    "authToken",
  ].map(normalizeKey),
);

/**
 * Generic PII terms matched as a *suffix* of the normalized key, so a
 * tool-specific compound name built around one of these (ownerEmail,
 * buyerPhone, billingAddress) is exactly as sensitive as the bare term —
 * without this, only a field literally named "email" would be caught, and
 * every realistic qualified variant would slip through.
 */
const SENSITIVE_SUFFIX_TOKENS = [
  "email",
  "phone",
  "phonenumber",
  "address",
  "ssn",
  "taxid",
].map(normalizeKey);

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (EXACT_SENSITIVE_FIELD_NAMES.has(normalized)) {
    return true;
  }
  return SENSITIVE_SUFFIX_TOKENS.some((token) => normalized.endsWith(token));
}

/**
 * Attempts to parse `raw` as JSON, returning undefined (never throwing) if
 * it isn't valid JSON or doesn't look like it was meant to be — most tool
 * outputs in this codebase are `JSON.stringify()`d before being returned
 * from `tool.run()`, so this is what lets redaction see into them instead
 * of treating the whole string as one opaque, unredactable blob.
 */
function tryParseJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

/**
 * Recursively walks `value`, replacing the value of any object key that
 * isSensitiveKey() flags with REDACTED. Everything else
 * (non-sensitive keys, array elements, primitives) passes through
 * unchanged — this is a denylist, not an allowlist, so an unrecognised
 * field is kept visible rather than dropped.
 *
 * A string value that parses as a JSON object/array is redacted as that
 * parsed structure (covering tool.run() implementations that return
 * `JSON.stringify(...)`); a string that isn't JSON is returned unchanged,
 * since there's no reliable way to find a named field inside free text.
 */
export function redactSensitiveFields(value: unknown): unknown {
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    return parsed === undefined ? value : redactSensitiveFields(parsed);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFields(item));
  }

  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = isSensitiveKey(key)
        ? REDACTED
        : redactSensitiveFields(entryValue);
    }
    return result;
  }

  return value;
}
