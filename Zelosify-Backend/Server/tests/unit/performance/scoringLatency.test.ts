/**
 * Performance Test: Scoring Engine Latency
 *
 * Validates that the deterministic matching engine can score 100 candidate
 * profiles in under 2 000 ms (P95 SLA).
 *
 * The scoring engine is pure synchronous math — no I/O, no mocking needed.
 * Tests use the exported scoring functions directly.
 */
import { describe, it, expect } from "vitest";
import {
  scoreExperience,
  scoreSkills,
  scoreLocation,
  calculateFinalScore,
  getDecision,
  matchingEngineTool,
  type MatchingInput,
} from "../../../src/services/ai/tools/matchingEngineTool.js";

// ── Helper: generate varied candidate inputs ──────────────────────────────────

const SKILL_POOL = [
  "typescript", "javascript", "react", "nodejs", "express",
  "postgresql", "mongodb", "redis", "aws", "docker",
  "kubernetes", "python", "fastapi", "graphql", "rest api",
  "microservices", "git", "ci/cd", "agile", "sql",
];

const LOCATION_POOL = [
  "Remote", "New York", "San Francisco", "London", "Berlin",
  "Singapore", "Sydney", "Toronto", "Paris", "Amsterdam",
];

function buildCandidateInput(index: number): MatchingInput {
  // Rotate through combinations deterministically so results are reproducible
  const expYears       = 1 + (index % 12);         // 1 – 12 years
  const skillCount     = 3 + (index % 8);           // 3 – 10 skills
  const candidateSkills = SKILL_POOL.slice(index % 10, (index % 10) + skillCount);
  const candidateLoc   = LOCATION_POOL[index % LOCATION_POOL.length];
  const requiredSkills = SKILL_POOL.slice(0, 5);    // fixed 5 required skills

  return {
    candidateExperienceYears: expYears,
    candidateNormalizedSkills: candidateSkills,
    candidateLocation: candidateLoc,
    openingExperienceMin: 3,
    openingExperienceMax: 8,
    openingRequiredSkills: requiredSkills,
    openingLocation: "Remote",
  };
}

// ── Unit tests for individual scoring functions ────────────────────────────────

describe("scoreExperience – boundary conditions", () => {
  it("returns 0 when candidate is below minimum", () => {
    expect(scoreExperience(1, 3, 7)).toBe(0);
  });

  it("returns 1.0 when candidate is exactly at minimum", () => {
    expect(scoreExperience(3, 3, 7)).toBe(1.0);
  });

  it("returns 1.0 when candidate is within range", () => {
    expect(scoreExperience(5, 3, 7)).toBe(1.0);
  });

  it("returns 1.0 when candidate is exactly at maximum", () => {
    expect(scoreExperience(7, 3, 7)).toBe(1.0);
  });

  it("returns 0.8 when candidate is overqualified (above max)", () => {
    expect(scoreExperience(10, 3, 7)).toBe(0.8);
  });

  it("returns 1.0 when no maximum is defined and candidate meets minimum", () => {
    expect(scoreExperience(15, 5, null)).toBe(1.0);
  });

  it("returns 0 when no maximum and candidate below minimum", () => {
    expect(scoreExperience(2, 5, null)).toBe(0);
  });
});

describe("scoreSkills – overlap ratio", () => {
  it("returns 1.0 when all required skills are present", () => {
    const score = scoreSkills(["typescript", "react", "nodejs"], ["typescript", "react", "nodejs"]);
    expect(score).toBe(1.0);
  });

  it("returns 0.5 when half of required skills are present", () => {
    const score = scoreSkills(["typescript", "react"], ["typescript", "react", "nodejs", "postgresql"]);
    expect(score).toBe(0.5);
  });

  it("returns 0 when no matching skills", () => {
    const score = scoreSkills(["python", "django"], ["typescript", "react"]);
    expect(score).toBe(0);
  });

  it("returns 1.0 when no required skills are defined (open requirement)", () => {
    const score = scoreSkills(["anything"], []);
    expect(score).toBe(1.0);
  });
});

describe("scoreLocation – remote and geo matching", () => {
  it("returns 1.0 for remote opening regardless of candidate location", () => {
    expect(scoreLocation("Tokyo", "Remote")).toBe(1.0);
    expect(scoreLocation("Berlin", "remote")).toBe(1.0); // case insensitive
  });

  it("returns 1.0 when candidate location matches opening location", () => {
    expect(scoreLocation("New York", "New York")).toBe(1.0);
  });

  it("returns 0.5 on location mismatch", () => {
    expect(scoreLocation("London", "New York")).toBe(0.5);
  });
});

describe("calculateFinalScore – weighted formula", () => {
  it("formula: 0.5×skill + 0.3×exp + 0.2×location", () => {
    // Perfect score
    expect(calculateFinalScore(1.0, 1.0, 1.0)).toBe(1.0);
  });

  it("gives correct result with known partial inputs", () => {
    // skill=0.6, exp=1.0, location=0.5
    // 0.5×0.6 + 0.3×1.0 + 0.2×0.5 = 0.30 + 0.30 + 0.10 = 0.70
    const score = calculateFinalScore(0.6, 1.0, 0.5);
    expect(score).toBeCloseTo(0.70, 5);
  });

  it("all zeros → score 0", () => {
    expect(calculateFinalScore(0, 0, 0)).toBe(0);
  });
});

describe("getDecision – threshold mapping", () => {
  it("maps score >= 0.75 to Recommended", () => {
    expect(getDecision(0.75)).toBe("Recommended");
    expect(getDecision(0.90)).toBe("Recommended");
    expect(getDecision(1.00)).toBe("Recommended");
  });

  it("maps score 0.50–0.74 to Borderline", () => {
    expect(getDecision(0.50)).toBe("Borderline");
    expect(getDecision(0.65)).toBe("Borderline");
    expect(getDecision(0.74)).toBe("Borderline");
  });

  it("maps score < 0.50 to Not Recommended", () => {
    expect(getDecision(0.49)).toBe("Not Recommended");
    expect(getDecision(0.00)).toBe("Not Recommended");
  });
});

// ── Performance: 100 profiles in < 2 000 ms ───────────────────────────────────

describe("Performance – scoring engine latency", () => {
  it("scores 100 candidate profiles in under 2 000 ms", () => {
    const PROFILE_COUNT = 100;
    const SLA_MS        = 2000;

    const inputs = Array.from({ length: PROFILE_COUNT }, (_, i) =>
      buildCandidateInput(i)
    );

    const start   = performance.now();
    const results = inputs.map((input) => matchingEngineTool(input));
    const elapsed = performance.now() - start;

    // All profiles must have been scored
    expect(results).toHaveLength(PROFILE_COUNT);

    // Every result must have a valid finalScore in [0, 1]
    for (const r of results) {
      expect(r.finalScore).toBeGreaterThanOrEqual(0);
      expect(r.finalScore).toBeLessThanOrEqual(1);
    }

    // SLA: 100 synchronous scorings must complete in under 2 000 ms
    expect(elapsed).toBeLessThan(SLA_MS);
  });

  it("scores 1 000 profiles in under 2 000 ms (stress variant)", () => {
    const PROFILE_COUNT = 1000;
    const SLA_MS        = 2000;

    const inputs = Array.from({ length: PROFILE_COUNT }, (_, i) =>
      buildCandidateInput(i)
    );

    const start   = performance.now();
    const results = inputs.map((input) => matchingEngineTool(input));
    const elapsed = performance.now() - start;

    expect(results).toHaveLength(PROFILE_COUNT);
    expect(elapsed).toBeLessThan(SLA_MS);
  });

  it("returns deterministic results for identical inputs", () => {
    const input = buildCandidateInput(0);

    const result1 = matchingEngineTool(input);
    const result2 = matchingEngineTool(input);
    const result3 = matchingEngineTool(input);

    expect(result1.finalScore).toBe(result2.finalScore);
    expect(result2.finalScore).toBe(result3.finalScore);
    expect(result1.skillMatchScore).toBe(result2.skillMatchScore);
  });

  it("produces all four decision categories across a varied input set", () => {
    const decisions = new Set<string>();

    // Craft inputs that are guaranteed to hit each threshold
    const scenarios: MatchingInput[] = [
      // Recommended: perfect skill + exp + remote location
      {
        candidateExperienceYears: 5,
        candidateNormalizedSkills: ["typescript", "react", "nodejs", "postgresql", "aws"],
        candidateLocation: "Remote",
        openingExperienceMin: 3,
        openingExperienceMax: 7,
        openingRequiredSkills: ["typescript", "react", "nodejs", "postgresql", "aws"],
        openingLocation: "Remote",
      },
      // Borderline: only 1 of 4 required skills matched → skill=0.25, exp=1.0, loc=1.0
      // final = 0.5×0.25 + 0.3×1.0 + 0.2×1.0 = 0.125 + 0.3 + 0.2 = 0.625
      {
        candidateExperienceYears: 4,
        candidateNormalizedSkills: ["typescript"],
        candidateLocation: "Remote",
        openingExperienceMin: 3,
        openingExperienceMax: 6,
        openingRequiredSkills: ["typescript", "react", "nodejs", "postgresql"],
        openingLocation: "Remote",
      },
      // Not Recommended: no matching skills, below min exp
      {
        candidateExperienceYears: 1,
        candidateNormalizedSkills: ["cobol", "fortran"],
        candidateLocation: "Tokyo",
        openingExperienceMin: 5,
        openingExperienceMax: 10,
        openingRequiredSkills: ["typescript", "react", "nodejs", "aws", "docker"],
        openingLocation: "New York",
      },
    ];

    for (const s of scenarios) {
      const { finalScore } = matchingEngineTool(s);
      decisions.add(getDecision(finalScore));
    }

    // Must produce at least Recommended, Borderline, Not Recommended
    expect(decisions.has("Recommended")).toBe(true);
    expect(decisions.has("Borderline")).toBe(true);
    expect(decisions.has("Not Recommended")).toBe(true);
  });
});
