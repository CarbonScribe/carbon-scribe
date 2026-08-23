import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

// Single shared Anthropic client for all agents in this service.
// TODO: add retry/backoff tuning and request-level cost logging here once
// usage patterns across agents are known.
export const anthropic = new Anthropic({
  apiKey: env.anthropicApiKey || undefined,
});

export const DEFAULT_MODEL = env.agentModel;
