import type { AgentCitation } from "../types/agent.types.js";

export interface DraftedSection {
  name: string;
  content: string;
}

export interface IncompleteSection {
  name: string;
  reason: string;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
  output: unknown;
}

export interface NumericGroundingInput {
  sections: DraftedSection[];
  incompleteSections: IncompleteSection[];
  citations: AgentCitation[];
  toolCalls: ToolCallRecord[];
}

export interface NumericGroundingResult {
  sections: DraftedSection[];
  incompleteSections: IncompleteSection[];
  reclassified: string[];
}

const NUMBER_TOKEN = /\d[\d,]*(?:\.\d+)?/g;

const UNIT_SUFFIX =
  /^\s*(?:%|(?:tco₂e|tco2e|tco₂|tco2|tc|t|tonnes?|tons?|hectares?|ha|acres?|percent|ppm|kg|mg|gg|km²|m²)(?![a-z])|per\s+(?:year|annum|ha|hectare))/i;

const QUANTIFIER_PREFIX =
  /(?:approximately|about|around|roughly|estimated|circa|nearly|some|over|under|up to|at least|at most|less than|more than|~)\s*$/i;

const YEAR = /^(?:19|20|21)\d{2}$/;

export function extractNumericClaims(content: string): string[] {
  const claims: string[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(NUMBER_TOKEN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const before = content[index - 1] ?? "";
    if (/[a-z]/i.test(before)) {
      continue;
    }

    const after = content.slice(index + raw.length);
    const next = after[0] ?? "";
    const unitMatched = UNIT_SUFFIX.test(after);
    const quantified = QUANTIFIER_PREFIX.test(
      content.slice(Math.max(0, index - 40), index),
    );

    if (!unitMatched && !quantified) {
      if (/[a-z]/i.test(next)) {
        continue;
      }
      if (YEAR.test(raw)) {
        continue;
      }
      const significant =
        raw.includes(",") ||
        raw.includes(".") ||
        raw.replace(/\D/g, "").length >= 3;
      if (!significant) {
        continue;
      }
    }

    if (!seen.has(raw)) {
      seen.add(raw);
      claims.push(raw);
    }
  }

  return claims;
}

function buildToolCallCorpus(toolCalls: ToolCallRecord[]): string {
  return toolCalls
    .map((call) =>
      JSON.stringify({
        name: call.name,
        input: call.input,
        output: call.output,
      }),
    )
    .join("\n")
    .toLowerCase();
}

export function citationTiesToToolCall(
  citation: AgentCitation,
  toolCallCorpus: string,
): boolean {
  const reference = citation.reference.trim().toLowerCase();
  return reference.length >= 3 && toolCallCorpus.includes(reference);
}

export function enforceNumericGrounding(
  input: NumericGroundingInput,
): NumericGroundingResult {
  const toolCallCorpus = buildToolCallCorpus(input.toolCalls);
  const hasGroundedCitation = input.citations.some((citation) =>
    citationTiesToToolCall(citation, toolCallCorpus),
  );

  const existingIncomplete = new Set(
    input.incompleteSections.map((section) => section.name),
  );
  const sections: DraftedSection[] = [];
  const incompleteSections: IncompleteSection[] = [...input.incompleteSections];
  const reclassified: string[] = [];

  for (const section of input.sections) {
    const claims = extractNumericClaims(section.content);
    if (claims.length === 0 || hasGroundedCitation) {
      sections.push(section);
      continue;
    }

    const shown = claims.slice(0, 3).join(", ");
    const ellipsis = claims.length > 3 ? ", …" : "";
    if (!existingIncomplete.has(section.name)) {
      incompleteSections.push({
        name: section.name,
        reason: `Ungrounded numeric claim: figure(s) ${shown}${ellipsis} with no citation traceable to a tool-call result from this run.`,
      });
      existingIncomplete.add(section.name);
    }
    reclassified.push(section.name);
  }

  return { sections, incompleteSections, reclassified };
}
