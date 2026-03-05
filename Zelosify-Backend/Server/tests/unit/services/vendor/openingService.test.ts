import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT_ID = "bruce-wayne-corp-tenant-id-001";
const VENDOR_ID = "vendor-001";
const OPENING_ID = "opening-001";

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeOpening(overrides = {}) {
  return {
    id: OPENING_ID,
    title: "Senior Backend Engineer",
    location: "Remote",
    contractType: "Full-Time Contract",
    postedDate: new Date("2026-01-01"),
    status: "OPEN",
    hiringManagerId: "hm-001",
    ...overrides,
  };
}

// ── fetchOpenings ─────────────────────────────────────────────────────────────
describe("fetchOpenings", () => {
  beforeEach(() => vi.resetModules());

  it("returns paginated openings with manager names", async () => {
    const opening = makeOpening();
    // $transaction receives an array of already-created promises.
    // We must mock opening.findMany / opening.count so they return promises,
    // then make $transaction resolve those promises.
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findMany: vi.fn().mockResolvedValue([opening]),
          count: vi.fn().mockResolvedValue(1),
        },
        $transaction: vi.fn().mockImplementation((promises) =>
          Promise.all(promises)
        ),
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: "hm-001", firstName: "Bruce", lastName: "Wayne" },
          ]),
        },
      },
    }));

    const { fetchOpenings } = await import(
      "../../../../src/services/vendor/openingService.js"
    );
    const result = await fetchOpenings(TENANT_ID, 1, 10);

    expect(result.total).toBe(1);
    expect(result.data[0].hiringManagerName).toBe("Bruce Wayne");
    expect(result.data[0].title).toBe("Senior Backend Engineer");
    expect(result.totalPages).toBe(1);
  });

  it("clamps pageSize to MAX_PAGE_SIZE (50)", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
        $transaction: vi.fn().mockImplementation((promises) =>
          Promise.all(promises)
        ),
        user: { findMany: vi.fn().mockResolvedValue([]) },
      },
    }));

    const { fetchOpenings } = await import(
      "../../../../src/services/vendor/openingService.js"
    );
    const result = await fetchOpenings(TENANT_ID, 1, 9999);

    expect(result.pageSize).toBe(50);
  });

  it("returns empty data when no openings exist", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
        $transaction: vi.fn().mockImplementation((promises) =>
          Promise.all(promises)
        ),
        user: { findMany: vi.fn().mockResolvedValue([]) },
      },
    }));

    const { fetchOpenings } = await import(
      "../../../../src/services/vendor/openingService.js"
    );
    const result = await fetchOpenings(TENANT_ID, 1, 10);

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });
});

// ── fetchOpeningDetail ────────────────────────────────────────────────────────
describe("fetchOpeningDetail", () => {
  beforeEach(() => vi.resetModules());

  it("returns opening detail with profiles and manager name", async () => {
    const opening = {
      ...makeOpening(),
      description: "Build scalable services",
      experienceMin: 5,
      experienceMax: 10,
      expectedCompletionDate: null,
      hiringProfiles: [
        {
          id: 1,
          s3Key: "tenant/opening/ts_cv.pdf",
          submittedAt: new Date(),
          status: "SUBMITTED",
          uploadedBy: VENDOR_ID,
        },
      ],
    };

    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findFirst: vi.fn().mockResolvedValue(opening),
        },
        user: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ firstName: "Lucius", lastName: "Fox" }),
        },
        hiringProfile: {
          count: vi.fn().mockResolvedValue(1),
        },
      },
    }));

    const { fetchOpeningDetail } = await import(
      "../../../../src/services/vendor/openingService.js"
    );
    const detail = await fetchOpeningDetail(OPENING_ID, TENANT_ID, VENDOR_ID);

    expect(detail).not.toBeNull();
    expect(detail!.hiringManagerName).toBe("Lucius Fox");
    expect(detail!.profilesCount).toBe(1);
    expect(detail!.profiles).toHaveLength(1);
  });

  it("returns null when opening does not exist in tenant", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue(null) },
        user: { findUnique: vi.fn() },
        hiringProfile: { count: vi.fn() },
      },
    }));

    const { fetchOpeningDetail } = await import(
      "../../../../src/services/vendor/openingService.js"
    );
    const detail = await fetchOpeningDetail("nonexistent", TENANT_ID, VENDOR_ID);

    expect(detail).toBeNull();
  });
});
