import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT_ID = "bruce-wayne-corp-tenant-id-001";
const MANAGER_ID = "hm-001";

function makeOpening(id: string, overrides = {}) {
  return {
    id,
    title: "Senior Backend Engineer",
    location: "Remote",
    contractType: "Full-Time Contract",
    status: "OPEN",
    postedDate: new Date("2026-01-01"),
    expectedCompletionDate: null,
    experienceMin: 5,
    experienceMax: 10,
    ...overrides,
  };
}

describe("fetchMyOpenings", () => {
  beforeEach(() => vi.resetModules());

  it("only returns openings where hiringManagerId matches userId", async () => {
    const opening = makeOpening("opening-001");
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findMany: vi.fn().mockResolvedValue([opening]),
          count: vi.fn().mockResolvedValue(1),
        },
        $transaction: vi.fn().mockImplementation((ps) => Promise.all(ps)),
        hiringProfile: {
          groupBy: vi.fn().mockResolvedValue([]),
        },
      },
    }));

    const { fetchMyOpenings } = await import(
      "../../../../src/services/hiring/openingService.js"
    );

    const result = await fetchMyOpenings(MANAGER_ID, TENANT_ID, 1, 10);

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("passes both tenantId and hiringManagerId to query where clause", async () => {
    const findManyMock = vi.fn().mockResolvedValue([]);
    const countMock = vi.fn().mockResolvedValue(0);

    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findMany: findManyMock, count: countMock },
        $transaction: vi.fn().mockImplementation((ps) => Promise.all(ps)),
        hiringProfile: { groupBy: vi.fn().mockResolvedValue([]) },
      },
    }));

    const { fetchMyOpenings } = await import(
      "../../../../src/services/hiring/openingService.js"
    );
    await fetchMyOpenings(MANAGER_ID, TENANT_ID, 1, 10);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: TENANT_ID,
          hiringManagerId: MANAGER_ID,
        }),
      })
    );
  });

  it("returns empty list when manager has no openings", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findMany: vi.fn().mockResolvedValue([]),
          count: vi.fn().mockResolvedValue(0),
        },
        $transaction: vi.fn().mockImplementation((ps) => Promise.all(ps)),
        hiringProfile: { groupBy: vi.fn().mockResolvedValue([]) },
      },
    }));

    const { fetchMyOpenings } = await import(
      "../../../../src/services/hiring/openingService.js"
    );
    const result = await fetchMyOpenings(MANAGER_ID, TENANT_ID, 1, 10);

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it("includes totalProfiles and pendingReview counts", async () => {
    const opening = makeOpening("opening-001");
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findMany: vi.fn().mockResolvedValue([opening]),
          count: vi.fn().mockResolvedValue(1),
        },
        $transaction: vi.fn().mockImplementation((ps) => Promise.all(ps)),
        hiringProfile: {
          groupBy: vi
            .fn()
            // First call = total profiles, second call = pending (SUBMITTED)
            .mockResolvedValueOnce([{ openingId: "opening-001", _count: { id: 5 } }])
            .mockResolvedValueOnce([{ openingId: "opening-001", _count: { id: 3 } }]),
        },
      },
    }));

    const { fetchMyOpenings } = await import(
      "../../../../src/services/hiring/openingService.js"
    );
    const result = await fetchMyOpenings(MANAGER_ID, TENANT_ID, 1, 10);

    expect(result.data[0].totalProfiles).toBe(5);
    expect(result.data[0].pendingReview).toBe(3);
  });
});
