import { describe, expect, it } from "vitest";
import { cachedSystem } from "./cache.js";

describe("cachedSystem (#830)", () => {
  it("wraps the prompt string in a text content block with ephemeral cache_control", () => {
    const prompt = "You are an AI assistant for compliance review.";
    const result = cachedSystem(prompt);

    expect(result).toEqual([
      {
        type: "text",
        text: prompt,
        cache_control: { type: "ephemeral" },
      },
    ]);
  });

  it("handles multi-line and empty prompts correctly", () => {
    const multiLine = "Line 1\nLine 2\nLine 3";
    expect(cachedSystem(multiLine)[0].text).toBe(multiLine);
    expect(cachedSystem(multiLine)[0].cache_control).toEqual({
      type: "ephemeral",
    });

    expect(cachedSystem("")).toEqual([
      {
        type: "text",
        text: "",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });
});
