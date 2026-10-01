import type Anthropic from "@anthropic-ai/sdk";

export interface MockRunnerParams {
  system?: string;
  tools?: unknown[];
  output_config?: { format?: unknown };
  messages?: Array<{ role: string; content: string | unknown }>;
}

export const DISCOVERY_FIXTURE_OUTPUT = {
  recommendations: [
    {
      creditId: "CR-REDD-001",
      justification: "Verified REDD+ carbon credits from certified Amazon basin project matching buyer criteria and budget.",
    },
    {
      creditId: "CR-ARR-002",
      justification: "High-permanence afforestation credits with verified biodiversity co-benefits.",
    },
  ],
  citations: [
    { source: "marketplace", reference: "CR-REDD-001" },
    { source: "marketplace", reference: "CR-ARR-002" },
  ],
  notes: "Shortlist matched based on sector, budget, and compliance framework.",
};

export const PDD_FIXTURE_OUTPUT = {
  methodology: "VM0007",
  sections: [
    {
      name: "Project Description",
      content: "Afforestation and ecological restoration project spanning 5,000 hectares.",
    },
    {
      name: "Additionality Analysis",
      content: "Demonstrated additionality via financial barrier and prevailing practice analysis.",
    },
  ],
  incompleteSections: [
    {
      name: "Soil Carbon Baseline",
      reason: "Missing historical soil lab test samples for sector 3.",
    },
  ],
  citations: [
    { source: "developer_submission", reference: "cadastral_deed_2026.pdf" },
  ],
};

export const COMPLIANCE_REPORT_FIXTURE_OUTPUT = {
  framework: "csrd" as const,
  sections: [
    {
      name: "Executive Summary",
      content: "Scope 1, 2, and 3 carbon offset retirement overview compliant with ESRS E1.",
    },
    {
      name: "Retirement Verification",
      content: "25,000 credits permanently retired and audited on public registry.",
    },
  ],
  gaps: [
    {
      description: "Scope 3 Category 4 transportation emissions data pending supplier verification.",
    },
  ],
  citations: [
    { source: "corporate_platform", reference: "retirement_ledger_q4_2025.json" },
  ],
};

export const ALERT_TRIAGE_FIXTURE_OUTPUT = {
  verdict: "escalate" as const,
  reasoning: "Corroborated 14% canopy NDVI drop with acoustic alerts indicating unauthorized clearing.",
  citations: [
    { source: "sentinel_hub", reference: "S2_L2A_CANOPY_ANOMALY_0920" },
  ],
};

export interface MockAnthropicOptions {
  latencyMs?: number;
}

export function createMockToolRunner(options: MockAnthropicOptions = {}) {
  const latencyMs = options.latencyMs ?? 0;

  return function mockToolRunner(params: MockRunnerParams) {
    const system = params.system ?? "";
    let fixtureJson: string;
    let toolName = "sample_tool";
    let toolInput: unknown = {};

    if (system.includes("credit-discovery")) {
      fixtureJson = JSON.stringify(DISCOVERY_FIXTURE_OUTPUT);
      toolName = "search_marketplace_credits";
      toolInput = { sector: "forestry" };
    } else if (system.includes("PDD")) {
      fixtureJson = JSON.stringify(PDD_FIXTURE_OUTPUT);
      toolName = "match_methodology";
      toolInput = { activity: "afforestation" };
    } else if (system.includes("compliance-report")) {
      fixtureJson = JSON.stringify(COMPLIANCE_REPORT_FIXTURE_OUTPUT);
      toolName = "get_company_retirement_evidence";
      toolInput = { framework: "csrd" };
    } else if (system.includes("alert-triage")) {
      fixtureJson = JSON.stringify(ALERT_TRIAGE_FIXTURE_OUTPUT);
      toolName = "get_monitoring_signals";
      toolInput = { alertId: "alert-99" };
    } else {
      fixtureJson = JSON.stringify(DISCOVERY_FIXTURE_OUTPUT);
    }

    const messages = [
      ...(params.messages ?? []),
      {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: toolName,
            input: toolInput,
          },
        ],
      },
    ];

    const finalMessage = {
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: fixtureJson,
        },
      ],
    };

    return {
      params: { messages },
      async then(
        onFulfilled?: ((value: unknown) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null,
      ) {
        if (latencyMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, latencyMs));
        }
        return Promise.resolve(finalMessage).then(
          onFulfilled ?? undefined,
          onRejected ?? undefined,
        );
      },
    };
  };
}

export function createMockAnthropicClient(options: MockAnthropicOptions = {}): Anthropic {
  const runner = createMockToolRunner(options);

  return {
    beta: {
      messages: {
        toolRunner: runner,
      },
    },
  } as unknown as Anthropic;
}
