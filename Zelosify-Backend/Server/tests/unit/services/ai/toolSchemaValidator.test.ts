import { describe, it, expect } from "vitest";
import {
  validateAgentOutput,
  validateScoringResult,
  safeParseAgentOutput,
  AgentOutputSchema,
} from "../../../../src/utils/ai/toolSchemaValidator.js";

describe("validateAgentOutput", () => {
  it("accepts a valid agent output", () => {
    const valid = {
      recommended: true,
      score: 0.82,
      confidence: 0.91,
      reason: "Strong skill match (80%), experience within range.",
    };
    expect(() => validateAgentOutput(valid)).not.toThrow();
    const result = validateAgentOutput(valid);
    expect(result.recommended).toBe(true);
    expect(result.score).toBe(0.82);
  });

  it("rejects output with missing fields", () => {
    expect(() => validateAgentOutput({ recommended: true })).toThrow();
  });

  it("rejects score out of range", () => {
    expect(() =>
      validateAgentOutput({ recommended: true, score: 1.5, confidence: 0.9, reason: "good match" })
    ).toThrow();
  });

  it("rejects too short reason", () => {
    expect(() =>
      validateAgentOutput({ recommended: false, score: 0.3, confidence: 0.8, reason: "bad" })
    ).toThrow();
  });
});

describe("validateScoringResult", () => {
  it("accepts a valid scoring result", () => {
    const valid = {
      skillMatchScore: 0.75,
      experienceMatchScore: 1.0,
      locationMatchScore: 0.5,
      finalScore: 0.725,
    };
    expect(() => validateScoringResult(valid)).not.toThrow();
  });

  it("rejects scores outside 0-1 range", () => {
    expect(() =>
      validateScoringResult({
        skillMatchScore: 1.1,
        experienceMatchScore: 1.0,
        locationMatchScore: 1.0,
        finalScore: 1.0,
      })
    ).toThrow();
  });
});

describe("safeParseAgentOutput", () => {
  it("parses valid JSON string", () => {
    const raw = JSON.stringify({
      recommended: true,
      score: 0.85,
      confidence: 0.9,
      reason: "Excellent skill and experience match for the role.",
    });
    const result = safeParseAgentOutput(raw);
    expect(result).not.toBeNull();
    expect(result!.recommended).toBe(true);
  });

  it("parses JSON wrapped in markdown code block", () => {
    const raw = `Here is my recommendation:\n\`\`\`json\n{"recommended":false,"score":0.4,"confidence":0.7,"reason":"Insufficient experience for the required role."}\n\`\`\``;
    const result = safeParseAgentOutput(raw);
    expect(result).not.toBeNull();
    expect(result!.recommended).toBe(false);
  });

  it("returns null for completely invalid input", () => {
    expect(safeParseAgentOutput("not json at all")).toBeNull();
    expect(safeParseAgentOutput("")).toBeNull();
    expect(safeParseAgentOutput("{ invalid }")).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const incomplete = JSON.stringify({ recommended: true, score: 0.8 });
    expect(safeParseAgentOutput(incomplete)).toBeNull();
  });
});
