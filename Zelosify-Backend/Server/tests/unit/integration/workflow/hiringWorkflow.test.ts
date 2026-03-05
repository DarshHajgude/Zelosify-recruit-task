/**
 * Integration Test: Full Hiring Workflow
 *
 * Simulates the end-to-end flow without a live DB or S3:
 *
 *   1. Vendor calls submitProfiles  → DB records created (SUBMITTED)
 *   2. AI agent runs (orchestrator mocked) → DB record updated with score/badge
 *   3. HM calls fetchProfilesForOpening → profiles returned with correct badge
 *   4. HM calls shortlistProfile → profile status changes to SHORTLISTED
 *
 * All Prisma interactions are mocked via vi.doMock + vi.resetModules().
 * vi.doUnmock is called before vi.doMock in each test to ensure fresh factories.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT_ID  = "bruce-wayne-corp-tenant-id-001";
const VENDOR_ID  = "vendor-001";
const MANAGER_ID = "hm-001";
const OPENING_ID = "opening-integration-001";
const PROFILE_ID = 42;
const S3_KEY     = `${TENANT_ID}/${OPENING_ID}/1700000000000_alice_cv.pdf`;

// ── Paths used across tests ────────────────────────────────────────────────────
const PRISMA_PATH       = "../../../../src/config/prisma/prisma.js";
const ORCHESTRATOR_PATH = "../../../../src/services/ai/agentOrchestrator.js";
const LOGGER_PATH       = "../../../../src/utils/observability/logger.js";
const PRESIGN_PATH      = "../../../../src/services/upload/filePresignService.js";
const UPLOAD_PATH       = "../../../../src/services/upload/fileUploadService.js";
const STORAGE_PATH      = "../../../../src/services/storage/storageFactory.js";
const REC_SVC_PATH      = "../../../../src/services/ai/recommendationService.js";

// ── Common mock helpers ────────────────────────────────────────────────────────

function makeSubmittedProfile() {
  return {
    id: PROFILE_ID,
    s3Key: S3_KEY,
    submittedAt: new Date("2026-01-15T10:00:00Z"),
    status: "SUBMITTED",
    uploadedBy: VENDOR_ID,
    isDeleted: false,
    recommended: null,
    recommendationScore: null,
    recommendationConfidence: null,
    recommendationReason: null,
    recommendationLatencyMs: null,
    recommendationVersion: null,
    recommendedAt: null,
  };
}

function makeScoredProfile() {
  return {
    ...makeSubmittedProfile(),
    recommended: true,
    recommendationScore: 0.82,
    recommendationConfidence: 0.91,
    recommendationReason: "Strong TypeScript + React skills, 6 yrs exp within range.",
    recommendationLatencyMs: 1234,
    recommendationVersion: "1.0.0",
    recommendedAt: new Date("2026-01-15T10:00:05Z"),
  };
}

/** Clear all module mocks and reset module cache in one call */
function resetAll() {
  vi.resetModules();
  vi.doUnmock(PRISMA_PATH);
  vi.doUnmock(ORCHESTRATOR_PATH);
  vi.doUnmock(LOGGER_PATH);
  vi.doUnmock(PRESIGN_PATH);
  vi.doUnmock(UPLOAD_PATH);
  vi.doUnmock(STORAGE_PATH);
  vi.doUnmock(REC_SVC_PATH);
}

// ── Step 1: Vendor submits profiles ───────────────────────────────────────────
describe("Step 1 – Vendor submits profiles", () => {
  beforeEach(resetAll);

  it("creates a SUBMITTED hiringProfile record and triggers AI async", async () => {
    const createMock = vi.fn().mockResolvedValue(makeSubmittedProfile());
    const txMock     = vi.fn().mockImplementation(async (ops) => Promise.all(ops));

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        opening: {
          findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID, status: "OPEN" }),
        },
        hiringProfile: { create: createMock },
        $transaction: txMock,
      },
    }));
    vi.doMock(PRESIGN_PATH, () => ({ FilePresignService: class {} }));
    vi.doMock(UPLOAD_PATH, () => ({
      FileUploadService: class {
        uploadFile = vi.fn().mockResolvedValue({ key: S3_KEY, filename: "alice_cv.pdf", success: true });
      },
    }));
    vi.doMock(STORAGE_PATH, () => ({ createStorageService: vi.fn() }));
    vi.doMock(REC_SVC_PATH, () => ({
      processRecommendation: vi.fn().mockResolvedValue(undefined),
    }));

    const { submitProfiles } = await import(
      "../../../../src/services/vendor/profileService.js"
    );

    const result = await submitProfiles(OPENING_ID, TENANT_ID, VENDOR_ID, [
      {
        uploadToken: "encrypted-token-abc",
        fileBuffer: Buffer.from("%PDF-1.4 fake pdf content"),
        mimeType: "application/pdf",
        originalName: "alice_cv.pdf",
      },
    ]);

    expect(result.profiles).toHaveLength(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          openingId: OPENING_ID,
          uploadedBy: VENDOR_ID,
          status: "SUBMITTED",
        }),
      })
    );
    expect(txMock).toHaveBeenCalledOnce();
  });
});

// ── Step 2: AI recommendation is processed ────────────────────────────────────
describe("Step 2 – AI recommendation is persisted", () => {
  beforeEach(resetAll);

  it("skips processing when profile is already scored (idempotency)", async () => {
    const alreadyScored = makeScoredProfile();
    const updateMock    = vi.fn();

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findUnique: vi.fn().mockResolvedValue(alreadyScored),
          update: updateMock,
        },
        opening: { findUnique: vi.fn() },
      },
    }));
    vi.doMock(ORCHESTRATOR_PATH, () => ({ orchestrate: vi.fn() }));
    vi.doMock(LOGGER_PATH, () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

    const { processRecommendation } = await import(
      "../../../../src/services/ai/recommendationService.js"
    );
    await processRecommendation(PROFILE_ID, OPENING_ID);

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns early when profile is not found in DB", async () => {
    const updateMock = vi.fn();

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findUnique: vi.fn().mockResolvedValue(null),
          update: updateMock,
        },
        opening: { findUnique: vi.fn() },
      },
    }));
    vi.doMock(ORCHESTRATOR_PATH, () => ({ orchestrate: vi.fn() }));
    vi.doMock(LOGGER_PATH, () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

    const { processRecommendation } = await import(
      "../../../../src/services/ai/recommendationService.js"
    );
    await expect(processRecommendation(9999, OPENING_ID)).resolves.toBeUndefined();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("runs orchestrator and persists AI score for an unprocessed profile", async () => {
    const submittedProfile = makeSubmittedProfile();
    const updateMock = vi.fn().mockResolvedValue({});
    const orchestrateMock = vi.fn().mockResolvedValue({
      output: { recommended: true, score: 0.82, confidence: 0.91, reason: "Strong match." },
      totalTokens: 512,
      toolCallCount: 3,
      version: "1.0.0",
    });

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findUnique: vi.fn().mockResolvedValue(submittedProfile),
          update: updateMock,
        },
        opening: {
          findUnique: vi.fn().mockResolvedValue({
            id: OPENING_ID,
            title: "Senior Frontend Engineer",
            description: "React, TypeScript, 5+ years",
            location: "Remote",
            experienceMin: 5,
            experienceMax: 8,
          }),
        },
      },
    }));
    vi.doMock(ORCHESTRATOR_PATH, () => ({ orchestrate: orchestrateMock }));
    vi.doMock(LOGGER_PATH, () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

    const { processRecommendation } = await import(
      "../../../../src/services/ai/recommendationService.js"
    );
    await processRecommendation(PROFILE_ID, OPENING_ID);

    expect(orchestrateMock).toHaveBeenCalledWith(
      submittedProfile.s3Key,
      expect.objectContaining({ id: OPENING_ID })
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROFILE_ID },
        data: expect.objectContaining({
          recommended: true,
          recommendationScore: 0.82,
          recommendationConfidence: 0.91,
        }),
      })
    );
  });

  it("persists error state when orchestrator throws", async () => {
    const submittedProfile = makeSubmittedProfile();
    const updateMock = vi.fn().mockResolvedValue({});

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findUnique: vi.fn().mockResolvedValue(submittedProfile),
          update: updateMock,
        },
        opening: {
          findUnique: vi.fn().mockResolvedValue({
            id: OPENING_ID,
            title: "Backend Engineer",
            description: null,
            location: "Remote",
            experienceMin: 3,
            experienceMax: null,
          }),
        },
      },
    }));
    vi.doMock(ORCHESTRATOR_PATH, () => ({
      orchestrate: vi.fn().mockRejectedValue(new Error("LLM API timeout")),
    }));
    vi.doMock(LOGGER_PATH, () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

    const { processRecommendation } = await import(
      "../../../../src/services/ai/recommendationService.js"
    );
    await processRecommendation(PROFILE_ID, OPENING_ID);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PROFILE_ID },
        data: expect.objectContaining({
          recommended: false,
          recommendationScore: 0,
          recommendationVersion: "error",
        }),
      })
    );
  });
});

// ── Step 3: HM views profiles with badge ─────────────────────────────────────
describe("Step 3 – HM views profiles with AI badge", () => {
  beforeEach(resetAll);

  it("returns Recommended badge for score >= 0.75", async () => {
    const scored = makeScoredProfile();

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([scored]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const profiles = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].badge).toBe("Recommended");
    expect(profiles[0].recommendationScore).toBe(0.82);
    expect(profiles[0].filename).toBe("alice_cv.pdf");
  });

  it("returns Borderline badge for score 0.50–0.74", async () => {
    const borderline = { ...makeScoredProfile(), recommended: false, recommendationScore: 0.62 };

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([borderline]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const profiles = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(profiles[0].badge).toBe("Borderline");
  });

  it("returns Not Recommended badge for score < 0.50", async () => {
    const notRecommended = { ...makeScoredProfile(), recommended: false, recommendationScore: 0.31 };

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([notRecommended]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const profiles = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(profiles[0].badge).toBe("Not Recommended");
  });

  it("returns Pending badge when AI has not processed the profile yet", async () => {
    const pending = makeSubmittedProfile();

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([pending]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const profiles = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(profiles[0].badge).toBe("Pending");
  });
});

// ── Step 4: HM shortlists a profile ───────────────────────────────────────────
describe("Step 4 – HM shortlists a Recommended profile", () => {
  beforeEach(resetAll);

  it("shortlists a SUBMITTED profile using a Prisma transaction", async () => {
    const txMock = vi.fn().mockResolvedValue([{}]);

    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: PROFILE_ID, status: "SUBMITTED" }),
          update: vi.fn().mockResolvedValue({}),
        },
        $transaction: txMock,
      },
    }));

    const { shortlistProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await shortlistProfile(PROFILE_ID, MANAGER_ID, TENANT_ID);

    expect(txMock).toHaveBeenCalledOnce();
  });

  it("rejects shortlisting an already SHORTLISTED profile", async () => {
    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: PROFILE_ID, status: "SHORTLISTED" }),
          update: vi.fn(),
        },
        $transaction: vi.fn(),
      },
    }));

    const { shortlistProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await expect(shortlistProfile(PROFILE_ID, MANAGER_ID, TENANT_ID)).rejects.toThrow("already shortlisted");
  });

  it("rejects shortlisting a REJECTED profile", async () => {
    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: PROFILE_ID, status: "REJECTED" }),
          update: vi.fn(),
        },
        $transaction: vi.fn(),
      },
    }));

    const { shortlistProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await expect(shortlistProfile(PROFILE_ID, MANAGER_ID, TENANT_ID)).rejects.toThrow("Cannot shortlist a rejected profile");
  });

  it("throws when profile is not found (wrong tenant or deleted)", async () => {
    vi.doMock(PRISMA_PATH, () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        $transaction: vi.fn(),
      },
    }));

    const { shortlistProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await expect(shortlistProfile(9999, MANAGER_ID, TENANT_ID)).rejects.toThrow("Profile not found");
  });
});

// ── Full sequential workflow in one test ─────────────────────────────────────
describe("End-to-end workflow (sequential mock)", () => {
  beforeEach(resetAll);

  it("tracks profile state transitions: SUBMITTED → scored → SHORTLISTED", async () => {
    const profileRow = makeSubmittedProfile();

    const prismaMock = {
      opening: {
        findFirst:  vi.fn().mockResolvedValue({ id: OPENING_ID, status: "OPEN" }),
        findUnique: vi.fn().mockResolvedValue({
          id: OPENING_ID, title: "SWE", description: "React typescript",
          location: "Remote", experienceMin: 3, experienceMax: 7,
        }),
      },
      hiringProfile: {
        create: vi.fn().mockResolvedValue(profileRow),
        findUnique: vi.fn().mockImplementation(() => ({ ...profileRow })),
        findFirst: vi.fn().mockImplementation(() => {
          if (profileRow.isDeleted) return null;
          return { id: profileRow.id, status: profileRow.status };
        }),
        findMany: vi.fn().mockImplementation(() => [{ ...profileRow }]),
        update: vi.fn().mockImplementation(({ data }) => {
          Object.assign(profileRow, data);
          return profileRow;
        }),
      },
      $transaction: vi.fn().mockImplementation(async (ops) => {
        if (Array.isArray(ops)) return Promise.all(ops);
        return ops(prismaMock);
      }),
    };

    vi.doMock(PRISMA_PATH, () => ({ default: prismaMock }));
    vi.doMock(PRESIGN_PATH, () => ({ FilePresignService: class {} }));
    vi.doMock(UPLOAD_PATH, () => ({
      FileUploadService: class {
        uploadFile = vi.fn().mockResolvedValue({ key: S3_KEY, filename: "alice_cv.pdf", success: true });
      },
    }));
    vi.doMock(STORAGE_PATH, () => ({ createStorageService: vi.fn() }));
    vi.doMock(ORCHESTRATOR_PATH, () => ({
      orchestrate: vi.fn().mockResolvedValue({
        output: { recommended: true, score: 0.85, confidence: 0.92, reason: "Great match." },
        totalTokens: 400,
        toolCallCount: 3,
        version: "1.0.0",
      }),
    }));
    vi.doMock(LOGGER_PATH, () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

    // Step A – submit profile (fires AI recommendation as fire-and-forget)
    const { submitProfiles } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    const submitResult = await submitProfiles(OPENING_ID, TENANT_ID, VENDOR_ID, [
      { uploadToken: "tok", fileBuffer: Buffer.from("pdf"), mimeType: "application/pdf", originalName: "alice_cv.pdf" },
    ]);
    expect(submitResult.profiles).toHaveLength(1);

    // Allow fire-and-forget to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    // AI has processed: profileRow updated by fire-and-forget
    expect(profileRow.recommended).toBe(true);
    expect(profileRow.recommendationScore).toBe(0.85);

    // Step B – HM views profile → Recommended badge
    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const profiles = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);
    expect(profiles[0].badge).toBe("Recommended");

    // Step C – HM shortlists
    const { shortlistProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await shortlistProfile(PROFILE_ID, MANAGER_ID, TENANT_ID);
    expect(profileRow.status).toBe("SHORTLISTED");
  });
});
