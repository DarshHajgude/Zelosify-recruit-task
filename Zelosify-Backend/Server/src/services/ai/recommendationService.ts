import prisma from "../../config/prisma/prisma.js";
import { orchestrate, type OpeningContext } from "./agentOrchestrator.js";
import { normalizeSkill } from "./tools/skillNormalizerTool.js";
import { logger } from "../../utils/observability/logger.js";

const SERVICE = "recommendationService";

/**
 * Extract likely required skills from an opening description.
 * We do a basic keyword scan — the LLM handles the full reasoning.
 */
function extractRequiredSkillsFromDescription(description: string | null): string[] {
  if (!description) return [];

  const knownSkills = [
    "javascript", "typescript", "python", "java", "golang", "rust", "c++",
    "react", "nextjs", "vuejs", "angular",
    "nodejs", "express", "nestjs", "fastapi", "django", "flask", "spring boot",
    "postgresql", "mysql", "mongodb", "redis",
    "aws", "gcp", "azure", "kubernetes", "docker", "terraform",
    "machine learning", "deep learning", "pytorch", "tensorflow", "scikit-learn",
    "rest api", "graphql", "microservices",
    "git", "ci/cd", "agile", "scrum", "sql", "prisma",
  ];

  const lower = description.toLowerCase();
  return knownSkills
    .filter((skill) => lower.includes(skill))
    .map(normalizeSkill);
}

/**
 * processRecommendation — the main entry point.
 *
 * Called automatically (async, non-blocking) after a vendor submits a profile.
 * Orchestrates the full AI agent pipeline and persists results in one DB update.
 */
export async function processRecommendation(
  profileId: number,
  openingId: string
): Promise<void> {
  const startTime = Date.now();

  logger.info(SERVICE, "Starting recommendation processing", { profileId, openingId });

  try {
    // 1. Fetch profile + opening from DB
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      select: { id: true, s3Key: true, status: true, recommended: true, resumeText: true },
    });

    if (!profile) {
      logger.error(SERVICE, "Profile not found", { profileId });
      return;
    }

    // Idempotency: skip if already processed
    if (profile.recommended !== null && profile.recommended !== undefined) {
      logger.info(SERVICE, "Profile already has recommendation, skipping", { profileId });
      return;
    }

    const opening = await prisma.opening.findUnique({
      where: { id: openingId },
      select: {
        id: true,
        title: true,
        description: true,
        location: true,
        experienceMin: true,
        experienceMax: true,
      },
    });

    if (!opening) {
      logger.error(SERVICE, "Opening not found", { openingId });
      return;
    }

    const openingContext: OpeningContext = {
      id: opening.id,
      title: opening.title,
      description: opening.description,
      location: opening.location ?? "Remote",
      experienceMin: opening.experienceMin,
      experienceMax: opening.experienceMax,
      requiredSkills: extractRequiredSkillsFromDescription(opening.description),
    };

    // 2. Run agent orchestration.
    //    Pass pre-parsed text if available (happy path: skips S3 download, ~500ms saved).
    //    Pass s3Key as fallback for profiles uploaded before this optimization.
    const result = await orchestrate(profile.resumeText ?? null, profile.s3Key, openingContext);

    const totalLatencyMs = Date.now() - startTime;

    logger.info(SERVICE, "Recommendation completed", {
      profileId,
      openingId,
      recommended: result.output.recommended,
      score: result.output.score,
      confidence: result.output.confidence,
      totalTokens: result.totalTokens,
      toolCallCount: result.toolCallCount,
      latencyMs: totalLatencyMs,
    });

    // 3. Persist result in DB (atomic update)
    await prisma.hiringProfile.update({
      where: { id: profileId },
      data: {
        recommended: result.output.recommended,
        recommendationScore: result.output.score,
        recommendationReason: result.output.reason,
        recommendationConfidence: result.output.confidence,
        recommendationLatencyMs: totalLatencyMs,
        recommendationVersion: result.version,
        recommendedAt: new Date(),
      },
    });

    logger.info(SERVICE, "Recommendation persisted", { profileId });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    logger.error(SERVICE, "Recommendation processing failed", {
      profileId,
      openingId,
      error: (error as Error).message,
      latencyMs,
    });

    // Persist failure state so HM can see it
    try {
      await prisma.hiringProfile.update({
        where: { id: profileId },
        data: {
          recommended: false,
          recommendationScore: 0,
          recommendationReason: `Processing failed: ${(error as Error).message}`,
          recommendationConfidence: 0,
          recommendationLatencyMs: latencyMs,
          recommendationVersion: "error",
          recommendedAt: new Date(),
        },
      });
    } catch (persistErr) {
      logger.error(SERVICE, "Failed to persist error state", {
        profileId,
        error: (persistErr as Error).message,
      });
    }
  }
}
