import { z } from "zod";

// ── Parsed Resume Schema ──────────────────────────────────────────────────────
export const ParsedResumeSchema = z.object({
  experienceYears: z.number().min(0).max(60),
  skills: z.array(z.string()).min(0).max(100),
  normalizedSkills: z.array(z.string()).min(0).max(100),
  location: z.string().max(200),
  education: z.array(z.string()).max(20),
  keywords: z.array(z.string()).max(50),
});
export type ParsedResume = z.infer<typeof ParsedResumeSchema>;

// ── Feature Vector Schema ─────────────────────────────────────────────────────
export const FeatureVectorSchema = z.object({
  experienceYears: z.number().min(0),
  skills: z.array(z.string()),
  normalizedSkills: z.array(z.string()),
  location: z.string(),
});
export type FeatureVector = z.infer<typeof FeatureVectorSchema>;

// ── Scoring Result Schema ─────────────────────────────────────────────────────
export const ScoringResultSchema = z.object({
  skillMatchScore: z.number().min(0).max(1),
  experienceMatchScore: z.number().min(0).max(1),
  locationMatchScore: z.number().min(0).max(1),
  finalScore: z.number().min(0).max(1),
});
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

// ── Final Agent Output Schema ─────────────────────────────────────────────────
export const AgentOutputSchema = z.object({
  recommended: z.boolean(),
  score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(10).max(1000),
});
export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// ── Validators ────────────────────────────────────────────────────────────────
export function validateParsedResume(data: unknown): ParsedResume {
  return ParsedResumeSchema.parse(data);
}

export function validateScoringResult(data: unknown): ScoringResult {
  return ScoringResultSchema.parse(data);
}

export function validateAgentOutput(data: unknown): AgentOutput {
  return AgentOutputSchema.parse(data);
}

export function safeParseAgentOutput(raw: string): AgentOutput | null {
  try {
    // Extract JSON from LLM response (may be wrapped in markdown code blocks)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    const parsed = JSON.parse(jsonStr.trim());
    return AgentOutputSchema.parse(parsed);
  } catch {
    return null;
  }
}
