import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT_ID = "bruce-wayne-corp-tenant-id-001";
const MANAGER_ID = "hm-001";
const OPENING_ID = "opening-001";
const PROFILE_ID = 1;

function makeProfile(overrides = {}) {
  return {
    id: PROFILE_ID,
    s3Key: `${TENANT_ID}/${OPENING_ID}/1700000000_cv.pdf`,
    submittedAt: new Date("2026-01-10"),
    status: "SUBMITTED",
    uploadedBy: "vendor-001",
    recommended: true,
    recommendationScore: 0.82,
    recommendationConfidence: 0.91,
    recommendationReason: "Strong skill match (80%), experience within range.",
    recommendationLatencyMs: 450,
    recommendationVersion: "1.0.0",
    recommendedAt: new Date("2026-01-10"),
    ...overrides,
  };
}

// ── fetchProfilesForOpening ───────────────────────────────────────────────────
describe("fetchProfilesForOpening", () => {
  beforeEach(() => vi.resetModules());

  it("returns profiles with badge and filename derived from s3Key", async () => {
    const profile = makeProfile();
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([profile]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const result = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].badge).toBe("Recommended");
    expect(result[0].filename).toBe("cv.pdf");
    expect(result[0].recommendationScore).toBe(0.82);
  });

  it("returns Pending badge when recommendation not yet processed", async () => {
    const profile = makeProfile({ recommended: null, recommendationScore: null });
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([profile]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const result = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(result[0].badge).toBe("Pending");
  });

  it("returns Borderline badge for score 0.5–0.74", async () => {
    const profile = makeProfile({ recommended: false, recommendationScore: 0.62 });
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([profile]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const result = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(result[0].badge).toBe("Borderline");
  });

  it("returns Not Recommended badge for score < 0.5", async () => {
    const profile = makeProfile({ recommended: false, recommendationScore: 0.3 });
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID }) },
        hiringProfile: { findMany: vi.fn().mockResolvedValue([profile]) },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    const result = await fetchProfilesForOpening(OPENING_ID, TENANT_ID);

    expect(result[0].badge).toBe("Not Recommended");
  });

  it("throws when opening not found in tenant", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue(null) },
        hiringProfile: { findMany: vi.fn() },
      },
    }));

    const { fetchProfilesForOpening } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await expect(
      fetchProfilesForOpening("nonexistent", TENANT_ID)
    ).rejects.toThrow("Opening not found");
  });
});

// ── shortlistProfile ──────────────────────────────────────────────────────────
describe("shortlistProfile", () => {
  beforeEach(() => vi.resetModules());

  it("shortlists a SUBMITTED profile", async () => {
    const updateMock = vi.fn().mockResolvedValue({});
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: PROFILE_ID, status: "SUBMITTED" }),
          update: updateMock,
        },
        $transaction: vi.fn().mockImplementation((ops) => Promise.all(ops)),
      },
    }));

    const { shortlistProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await shortlistProfile(PROFILE_ID, MANAGER_ID, TENANT_ID);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SHORTLISTED",
          shortlistedBy: MANAGER_ID,
        }),
      })
    );
  });

  it("throws when profile is already shortlisted", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
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
    await expect(shortlistProfile(PROFILE_ID, MANAGER_ID, TENANT_ID)).rejects.toThrow(
      "already shortlisted"
    );
  });

  it("throws when profile is already rejected", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
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
    await expect(shortlistProfile(PROFILE_ID, MANAGER_ID, TENANT_ID)).rejects.toThrow(
      "Cannot shortlist a rejected"
    );
  });

  it("throws when profile not found (cross-tenant protection)", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
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
    await expect(shortlistProfile(999, MANAGER_ID, TENANT_ID)).rejects.toThrow(
      "Profile not found"
    );
  });
});

// ── rejectProfile ─────────────────────────────────────────────────────────────
describe("rejectProfile", () => {
  beforeEach(() => vi.resetModules());

  it("rejects a SUBMITTED profile", async () => {
    const updateMock = vi.fn().mockResolvedValue({});
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: PROFILE_ID, status: "SUBMITTED" }),
          update: updateMock,
        },
        $transaction: vi.fn().mockImplementation((ops) => Promise.all(ops)),
      },
    }));

    const { rejectProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await rejectProfile(PROFILE_ID, MANAGER_ID, TENANT_ID);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          rejectedBy: MANAGER_ID,
        }),
      })
    );
  });

  it("throws when profile is already rejected", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: PROFILE_ID, status: "REJECTED" }),
          update: vi.fn(),
        },
        $transaction: vi.fn(),
      },
    }));

    const { rejectProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await expect(rejectProfile(PROFILE_ID, MANAGER_ID, TENANT_ID)).rejects.toThrow(
      "already rejected"
    );
  });

  it("uses hiringManagerId in findFirst query to prevent cross-HM access", async () => {
    const findFirstMock = vi.fn().mockResolvedValue(null);
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: findFirstMock,
          update: vi.fn(),
        },
        $transaction: vi.fn(),
      },
    }));

    const { rejectProfile } = await import(
      "../../../../src/services/hiring/profileService.js"
    );
    await expect(rejectProfile(PROFILE_ID, MANAGER_ID, TENANT_ID)).rejects.toThrow();

    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          opening: expect.objectContaining({
            hiringManagerId: MANAGER_ID,
            tenantId: TENANT_ID,
          }),
        }),
      })
    );
  });
});
