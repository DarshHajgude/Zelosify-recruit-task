import { describe, it, expect } from "vitest";
import {
  scoreExperience,
  scoreSkills,
  scoreLocation,
  calculateFinalScore,
  getDecision,
  matchingEngineTool,
} from "../../../../src/services/ai/tools/matchingEngineTool.js";

// ── Experience boundary tests ─────────────────────────────────────────────────
describe("scoreExperience", () => {
  it("returns 0 when candidate is below minimum", () => {
    expect(scoreExperience(1, 5, 10)).toBe(0);
    expect(scoreExperience(0, 3, null)).toBe(0);
    expect(scoreExperience(4, 5, null)).toBe(0);
  });

  it("returns 1.0 when candidate is exactly at minimum", () => {
    expect(scoreExperience(5, 5, 10)).toBe(1.0);
    expect(scoreExperience(3, 3, null)).toBe(1.0);
  });

  it("returns 1.0 when candidate is within range", () => {
    expect(scoreExperience(7, 5, 10)).toBe(1.0);
    expect(scoreExperience(5, 5, 5)).toBe(1.0);
  });

  it("returns 1.0 when no upper bound and candidate meets minimum", () => {
    expect(scoreExperience(15, 5, null)).toBe(1.0);
    expect(scoreExperience(100, 1, null)).toBe(1.0);
  });

  it("returns 0.8 when candidate exceeds maximum (overqualified)", () => {
    expect(scoreExperience(11, 5, 10)).toBe(0.8);
    expect(scoreExperience(20, 3, 8)).toBe(0.8);
  });

  it("returns 0 for 0 years when min > 0", () => {
    expect(scoreExperience(0, 1, 5)).toBe(0);
  });
});

// ── Skill overlap accuracy tests ──────────────────────────────────────────────
describe("scoreSkills", () => {
  it("returns 1.0 when candidate has all required skills", () => {
    expect(scoreSkills(["javascript", "react", "nodejs"], ["javascript", "react", "nodejs"])).toBe(1.0);
  });

  it("returns 0.5 when candidate has half the required skills", () => {
    expect(scoreSkills(["javascript", "react"], ["javascript", "react", "nodejs", "typescript"])).toBe(0.5);
  });

  it("returns 0 when candidate has none of the required skills", () => {
    expect(scoreSkills(["java", "spring"], ["javascript", "react"])).toBe(0);
  });

  it("returns 1.0 when no required skills are specified", () => {
    expect(scoreSkills(["python", "django"], [])).toBe(1.0);
  });

  it("handles partial overlap with normalization", () => {
    // "nodejs" and "node.js" should both match "nodejs"
    const score = scoreSkills(["node.js", "react"], ["nodejs", "react", "typescript"]);
    expect(score).toBeCloseTo(0.667, 2);
  });

  it("is case-insensitive after normalization", () => {
    expect(scoreSkills(["JavaScript", "React"], ["javascript", "react"])).toBe(1.0);
  });

  it("returns 1.0 for exact single skill match", () => {
    expect(scoreSkills(["python"], ["python"])).toBe(1.0);
  });
});

// ── Location match tests ──────────────────────────────────────────────────────
describe("scoreLocation", () => {
  it("returns 1.0 when opening is Remote", () => {
    expect(scoreLocation("Gotham City", "Remote")).toBe(1.0);
    expect(scoreLocation("anywhere", "Remote")).toBe(1.0);
    expect(scoreLocation("", "Remote")).toBe(1.0);
  });

  it("returns 1.0 when candidate location exactly matches opening", () => {
    expect(scoreLocation("Gotham City", "Gotham City")).toBe(1.0);
    expect(scoreLocation("gotham city", "Gotham City")).toBe(1.0);
  });

  it("returns 0.5 when locations mismatch", () => {
    expect(scoreLocation("Metropolis", "Gotham City")).toBe(0.5);
    expect(scoreLocation("New York", "London")).toBe(0.5);
  });

  it("is case-insensitive for matching", () => {
    expect(scoreLocation("GOTHAM CITY", "gotham city")).toBe(1.0);
  });
});

// ── Final score formula correctness ──────────────────────────────────────────
describe("calculateFinalScore", () => {
  it("applies (0.5 × skill) + (0.3 × exp) + (0.2 × loc) formula correctly", () => {
    expect(calculateFinalScore(1.0, 1.0, 1.0)).toBeCloseTo(1.0);
    expect(calculateFinalScore(0.0, 0.0, 0.0)).toBeCloseTo(0.0);
    expect(calculateFinalScore(0.8, 1.0, 1.0)).toBeCloseTo(0.5 * 0.8 + 0.3 * 1.0 + 0.2 * 1.0);
    expect(calculateFinalScore(1.0, 0.0, 1.0)).toBeCloseTo(0.5 * 1.0 + 0.3 * 0.0 + 0.2 * 1.0);
  });

  it("skill is the dominant factor (0.5 weight)", () => {
    const skillHeavy = calculateFinalScore(1.0, 0.0, 0.0);
    const expHeavy = calculateFinalScore(0.0, 1.0, 0.0);
    expect(skillHeavy).toBeGreaterThan(expHeavy);
  });

  it("produces expected score for real-world scenario", () => {
    // 80% skill, within exp range, location mismatch
    const score = calculateFinalScore(0.8, 1.0, 0.5);
    // 0.5*0.8 + 0.3*1.0 + 0.2*0.5 = 0.4 + 0.3 + 0.1 = 0.8
    expect(score).toBeCloseTo(0.8);
  });
});

// ── Decision threshold tests ──────────────────────────────────────────────────
describe("getDecision", () => {
  it("returns Recommended for score >= 0.75", () => {
    expect(getDecision(0.75)).toBe("Recommended");
    expect(getDecision(0.9)).toBe("Recommended");
    expect(getDecision(1.0)).toBe("Recommended");
  });

  it("returns Borderline for score 0.5–0.74", () => {
    expect(getDecision(0.5)).toBe("Borderline");
    expect(getDecision(0.6)).toBe("Borderline");
    expect(getDecision(0.74)).toBe("Borderline");
  });

  it("returns Not Recommended for score < 0.5", () => {
    expect(getDecision(0.0)).toBe("Not Recommended");
    expect(getDecision(0.3)).toBe("Not Recommended");
    expect(getDecision(0.499)).toBe("Not Recommended");
  });
});

// ── matchingEngineTool integration ───────────────────────────────────────────
describe("matchingEngineTool", () => {
  it("returns validated scoring result with all fields", () => {
    const result = matchingEngineTool({
      candidateExperienceYears: 7,
      candidateNormalizedSkills: ["javascript", "react", "nodejs", "typescript"],
      candidateLocation: "Remote",
      openingExperienceMin: 5,
      openingExperienceMax: 10,
      openingRequiredSkills: ["javascript", "react", "nodejs", "typescript"],
      openingLocation: "Remote",
    });

    expect(result).toHaveProperty("skillMatchScore");
    expect(result).toHaveProperty("experienceMatchScore");
    expect(result).toHaveProperty("locationMatchScore");
    expect(result).toHaveProperty("finalScore");
    expect(result.skillMatchScore).toBe(1.0);
    expect(result.experienceMatchScore).toBe(1.0);
    expect(result.locationMatchScore).toBe(1.0);
    expect(result.finalScore).toBe(1.0);
  });

  it("correctly penalises underqualified candidate", () => {
    const result = matchingEngineTool({
      candidateExperienceYears: 1,
      candidateNormalizedSkills: ["javascript"],
      candidateLocation: "Gotham City",
      openingExperienceMin: 5,
      openingExperienceMax: 10,
      openingRequiredSkills: ["javascript", "react", "nodejs", "typescript"],
      openingLocation: "Remote",
    });

    // exp=0 (below min), skill=0.25 (1/4 skills), location=1.0 (remote)
    expect(result.experienceMatchScore).toBe(0);
    expect(result.skillMatchScore).toBeCloseTo(0.25);
    expect(result.locationMatchScore).toBe(1.0);
    expect(result.finalScore).toBeCloseTo(0.5 * 0.25 + 0.3 * 0 + 0.2 * 1.0);
  });

  it("rounds scores to 3 decimal places", () => {
    const result = matchingEngineTool({
      candidateExperienceYears: 6,
      candidateNormalizedSkills: ["javascript", "react"],
      candidateLocation: "Metropolis",
      openingExperienceMin: 5,
      openingExperienceMax: 10,
      openingRequiredSkills: ["javascript", "react", "nodejs"],
      openingLocation: "Gotham City",
    });
    // skill: 2/3 ≈ 0.667
    expect(String(result.skillMatchScore).split(".")[1]?.length ?? 0).toBeLessThanOrEqual(3);
  });
});

// ── Skill normalizer ──────────────────────────────────────────────────────────
import { normalizeSkill, normalizeSkillsTool } from "../../../../src/services/ai/tools/skillNormalizerTool.js";

describe("normalizeSkill", () => {
  it("normalizes common aliases", () => {
    expect(normalizeSkill("Node.js")).toBe("nodejs");
    expect(normalizeSkill("ReactJS")).toBe("react");
    expect(normalizeSkill("TypeScript")).toBe("typescript");
    expect(normalizeSkill("PostgreSQL")).toBe("postgresql");
    expect(normalizeSkill("k8s")).toBe("kubernetes");
  });

  it("returns hyphenated form for unknown skills", () => {
    expect(normalizeSkill("my custom skill")).toBe("my-custom-skill");
  });
});

describe("normalizeSkillsTool", () => {
  it("returns original and normalized arrays of same length", () => {
    const result = normalizeSkillsTool(["Node.js", "React", "TypeScript"]);
    expect(result.original).toHaveLength(3);
    expect(result.normalized).toHaveLength(3);
    expect(result.normalized).toEqual(["nodejs", "react", "typescript"]);
  });
});
