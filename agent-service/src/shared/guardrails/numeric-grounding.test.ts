import { describe, expect, it } from "vitest";
import {
  enforceNumericGrounding,
  extractNumericClaims,
  citationTiesToToolCall,
} from "./numeric-grounding.js";

const TOOL_CALLS = [
  {
    name: "match_methodology",
    input: { activityType: "agroforestry", country: "KE", hectares: 150 },
    output: {
      matched: true,
      methodology: "agroforestry",
      methodologyId: "AGRO-01",
    },
  },
];

const CORPUS = JSON.stringify(TOOL_CALLS).toLowerCase();

describe("extractNumericClaims", () => {
  it("detects unit-anchored tonnage, area, and percentage figures", () => {
    const content =
      "The project will sequester 1,200 tCO2e over 150 ha, a 12% increase, roughly 45 tonnes of biochar.";
    expect(extractNumericClaims(content)).toEqual(["1,200", "150", "12", "45"]);
  });

  it("detects quantified standalone figures", () => {
    expect(
      extractNumericClaims("An estimated 4,800 hectares will be restored."),
    ).toEqual(["4,800"]);
  });

  it("skips years, list markers, and alphanumeric tokens", () => {
    const content =
      "1. Project context established in 2019. 2. Monitoring plan. CO2 is measured via PM2.5 sensors.";
    expect(extractNumericClaims(content)).toEqual([]);
  });
});

describe("citationTiesToToolCall", () => {
  it("matches a reference that appears in a tool call from this run", () => {
    expect(
      citationTiesToToolCall(
        { source: "methodology-registry", reference: "AGRO-01" },
        CORPUS,
      ),
    ).toBe(true);
  });

  it("rejects a reference with no tool-call provenance or trivial length", () => {
    expect(
      citationTiesToToolCall(
        { source: "developer-submission", reference: "made-up-9999" },
        CORPUS,
      ),
    ).toBe(false);
    expect(
      citationTiesToToolCall({ source: "x", reference: "ab" }, CORPUS),
    ).toBe(false);
  });
});

describe("enforceNumericGrounding", () => {
  it("keeps a section whose numeric claim is backed by a tool-call-tied citation", () => {
    const result = enforceNumericGrounding({
      sections: [
        {
          name: "Baseline Carbon Stock",
          content: "The baseline estimates 1,200 tCO2e across 150 ha.",
        },
      ],
      incompleteSections: [],
      citations: [{ source: "methodology-registry", reference: "AGRO-01" }],
      toolCalls: TOOL_CALLS,
    });

    expect(result.sections).toHaveLength(1);
    expect(result.incompleteSections).toEqual([]);
    expect(result.reclassified).toEqual([]);
  });

  it("reclassifies a section whose numeric claim has no supporting citation", () => {
    const result = enforceNumericGrounding({
      sections: [
        {
          name: "Baseline Carbon Stock",
          content: "The baseline estimates 1,200 tCO2e across 150 ha.",
        },
      ],
      incompleteSections: [],
      citations: [],
      toolCalls: TOOL_CALLS,
    });

    expect(result.sections).toEqual([]);
    expect(result.reclassified).toEqual(["Baseline Carbon Stock"]);
    expect(result.incompleteSections).toEqual([
      {
        name: "Baseline Carbon Stock",
        reason: expect.stringMatching(/ungrounded numeric claim/i),
      },
    ]);
  });

  it("reclassifies when citations exist but none tie back to a tool-call result", () => {
    const result = enforceNumericGrounding({
      sections: [
        {
          name: "Emission Reductions",
          content:
            "Projected reductions of 8,400 tCO2e over the crediting period.",
        },
      ],
      incompleteSections: [],
      citations: [{ source: "developer-assertion", reference: "invented-77" }],
      toolCalls: TOOL_CALLS,
    });

    expect(result.sections).toEqual([]);
    expect(result.incompleteSections[0]?.reason).toMatch(
      /ungrounded numeric claim/i,
    );
  });

  it("leaves sections without numeric claims untouched even when nothing is grounded", () => {
    const result = enforceNumericGrounding({
      sections: [
        {
          name: "Project Description",
          content:
            "The project description covers community engagement and nursery operations.",
        },
      ],
      incompleteSections: [],
      citations: [],
      toolCalls: [],
    });

    expect(result.sections).toHaveLength(1);
    expect(result.incompleteSections).toEqual([]);
    expect(result.reclassified).toEqual([]);
  });

  it("preserves self-reported incomplete sections and avoids duplicate names", () => {
    const result = enforceNumericGrounding({
      sections: [
        { name: "Monitoring Plan", content: "Sequestration of 300 tCO2e." },
      ],
      incompleteSections: [
        { name: "Monitoring Plan", reason: "Missing sample data." },
      ],
      citations: [],
      toolCalls: [],
    });

    expect(result.sections).toEqual([]);
    expect(result.incompleteSections).toHaveLength(1);
    expect(result.reclassified).toEqual(["Monitoring Plan"]);
  });
});
