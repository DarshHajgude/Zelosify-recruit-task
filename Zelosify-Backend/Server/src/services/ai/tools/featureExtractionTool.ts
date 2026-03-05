import { normalizeSkill } from "./skillNormalizerTool.js";
import { logger } from "../../../utils/observability/logger.js";

const SERVICE = "featureExtractionTool";

export interface ExtractedFeatures {
  experienceYears: number;
  skills: string[];
  normalizedSkills: string[];
  location: string;
  education: string[];
  keywords: string[];
}

/**
 * Tool: extract_features
 *
 * Validates and structures the fields extracted by the LLM from resume text.
 * Also normalizes skills in-place so the next tool (calculate_match_score)
 * receives canonical skill names directly.
 *
 * This is a deterministic validation + normalization step — it does NOT call
 * the LLM. The LLM is responsible for reading the resume and passing the
 * extracted values; this tool enforces schema correctness and consistency.
 */
export function extractFeaturesTool(input: {
  experienceYears: number;
  skills: string[];
  location: string;
  education: string[];
  keywords: string[];
}): ExtractedFeatures {
  const start = Date.now();

  // Clamp and sanitize
  const experienceYears = Math.max(0, Math.min(60, Number(input.experienceYears) || 0));
  const skills = (input.skills ?? []).slice(0, 100).map((s) => String(s).trim()).filter(Boolean);
  const normalizedSkills = skills.map(normalizeSkill);
  const location = String(input.location ?? "").trim() || "Unknown";
  const education = (input.education ?? []).slice(0, 20).map((e) => String(e).trim()).filter(Boolean);
  const keywords = (input.keywords ?? []).slice(0, 50).map((k) => String(k).trim()).filter(Boolean);

  const result: ExtractedFeatures = {
    experienceYears,
    skills,
    normalizedSkills,
    location,
    education,
    keywords,
  };

  logger.info(SERVICE, "Features extracted and normalized", {
    experienceYears,
    rawSkillCount: skills.length,
    normalizedSkillCount: normalizedSkills.length,
    location,
    latencyMs: Date.now() - start,
  });

  return result;
}
