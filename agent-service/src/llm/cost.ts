/**
 * Per-model cost estimation for LLM token usage (#829).
 *
 * Clearly documented as an estimate: actual upstream invoices reflect Anthropic's
 * exact billing calculations and volume discounts.
 */

export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cacheCreationPerMillion: number;
  cacheReadPerMillion: number;
}

export const DEFAULT_PRICING_TABLE: Record<string, ModelPricing> = {
  "claude-3-5-sonnet": {
    inputPerMillion: 3.0,
    outputPerMillion: 15.0,
    cacheCreationPerMillion: 3.75,
    cacheReadPerMillion: 0.3,
  },
  "claude-3-opus": {
    inputPerMillion: 15.0,
    outputPerMillion: 75.0,
    cacheCreationPerMillion: 18.75,
    cacheReadPerMillion: 1.5,
  },
  "claude-3-5-haiku": {
    inputPerMillion: 0.8,
    outputPerMillion: 4.0,
    cacheCreationPerMillion: 1.0,
    cacheReadPerMillion: 0.08,
  },
};

export function getModelPricing(model: string): ModelPricing {
  const customConfig = process.env["AGENT_MODEL_PRICING"];
  if (customConfig) {
    try {
      const parsed = JSON.parse(customConfig) as Record<string, ModelPricing>;
      if (parsed[model]) {
        return parsed[model];
      }
    } catch {
      // Fall back to default table on invalid JSON
    }
  }

  const normalized = model.toLowerCase();
  if (normalized.includes("opus")) {
    return DEFAULT_PRICING_TABLE["claude-3-opus"]!;
  }
  if (normalized.includes("haiku")) {
    return DEFAULT_PRICING_TABLE["claude-3-5-haiku"]!;
  }
  return DEFAULT_PRICING_TABLE["claude-3-5-sonnet"]!;
}

export function estimateRunCost(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}): number {
  const pricing = getModelPricing(params.model);
  const cacheCreation = params.cacheCreationInputTokens ?? 0;
  const cacheRead = params.cacheReadInputTokens ?? 0;

  const cost =
    (params.inputTokens * pricing.inputPerMillion +
      params.outputTokens * pricing.outputPerMillion +
      cacheCreation * pricing.cacheCreationPerMillion +
      cacheRead * pricing.cacheReadPerMillion) /
    1_000_000;

  return Number(cost.toFixed(6));
}
