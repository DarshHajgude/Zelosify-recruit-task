import { ScoringResult, validateScoringResult } from "../../../utils/ai/toolSchemaValidator.js";
import { normalizeSkill } from "./skillNormalizerTool.js";

export interface MatchingInput {
  candidateExperienceYears: number;
  candidateNormalizedSkills: string[];
  candidateLocation: string;
  openingExperienceMin: number;
  openingExperienceMax: number | null;
  openingRequiredSkills: string[];  // already normalized
  openingLocation: string;
}

// ── Individual scorers ────────────────────────────────────────────────────────

/**
 * Experience match score.
 * - Below minimum → 0
 * - Within range [min, max] → 1.0
 * - Above maximum → 0.8 (overqualified but still valuable)
 * - No max defined → 1.0 if >= min
 */
export function scoreExperience(
  candidateYears: number,
  min: number,
  max: number | null
): number {
  if (candidateYears < min) return 0;
  if (max === null || max === undefined) return 1.0;
  if (candidateYears <= max) return 1.0;
  return 0.8; // overqualified
}

/**
 * Skill match score.
 * - Overlap = candidate skills ∩ required skills
 * - Score = |overlap| / |required|
 * - If no required skills listed → 1.0 (open requirement)
 */
export function scoreSkills(
  candidateNormalized: string[],
  requiredNormalized: string[]
): number {
  if (requiredNormalized.length === 0) return 1.0;
  const candidateSet = new Set(candidateNormalized.map((s) => normalizeSkill(s)));
  const overlap = requiredNormalized.filter((s) => candidateSet.has(normalizeSkill(s)));
  return overlap.length / requiredNormalized.length;
}

/**
 * Location match score.
 * - Opening is "remote" → 1.0 (location irrelevant)
 * - Candidate location matches opening (case-insensitive) → 1.0
 * - Mismatch → 0.5
 */
export function scoreLocation(
  candidateLocation: string,
  openingLocation: string
): number {
  const openingLower = openingLocation.trim().toLowerCase();
  if (openingLower === "remote") return 1.0;
  if (candidateLocation.trim().toLowerCase() === openingLower) return 1.0;
  return 0.5;
}

/**
 * Final weighted score formula (MANDATORY — must not be changed).
 * FinalScore = (0.5 × skillMatch) + (0.3 × expMatch) + (0.2 × locationMatch)
 */
export function calculateFinalScore(
  skillMatchScore: number,
  experienceMatchScore: number,
  locationMatchScore: number
): number {
  return (
    0.5 * skillMatchScore +
    0.3 * experienceMatchScore +
    0.2 * locationMatchScore
  );
}

export type RecommendationDecision = "Recommended" | "Borderline" | "Not Recommended";

export function getDecision(finalScore: number): RecommendationDecision {
  if (finalScore >= 0.75) return "Recommended";
  if (finalScore >= 0.5) return "Borderline";
  return "Not Recommended";
}

// ── Tool entry point ──────────────────────────────────────────────────────────

/**
 * Tool: calculate_match_score
 *
 * Deterministic matching engine invoked as an LLM tool.
 * The LLM MUST call this tool — it must NOT calculate scores itself.
 * All math is performed here, outside LLM context, for explainability.
 */
export function matchingEngineTool(input: MatchingInput): ScoringResult {
  const skillMatchScore = scoreSkills(
    input.candidateNormalizedSkills,
    input.openingRequiredSkills
  );
  const experienceMatchScore = scoreExperience(
    input.candidateExperienceYears,
    input.openingExperienceMin,
    input.openingExperienceMax
  );
  const locationMatchScore = scoreLocation(
    input.candidateLocation,
    input.openingLocation
  );
  const finalScore = calculateFinalScore(skillMatchScore, experienceMatchScore, locationMatchScore);

  const result = {
    skillMatchScore: Math.round(skillMatchScore * 1000) / 1000,
    experienceMatchScore: Math.round(experienceMatchScore * 1000) / 1000,
    locationMatchScore: Math.round(locationMatchScore * 1000) / 1000,
    finalScore: Math.round(finalScore * 1000) / 1000,
  };

  // Validate output before returning to the agent
  return validateScoringResult(result);
}
