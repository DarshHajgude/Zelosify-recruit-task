import prisma from "../../config/prisma/prisma.js";

export interface HMOpeningListItem {
  id: string;
  title: string;
  location: string | null;
  contractType: string | null;
  status: string;
  postedDate: Date;
  expectedCompletionDate: Date | null;
  experienceMin: number;
  experienceMax: number | null;
  totalProfiles: number;
  pendingReview: number;   // profiles not yet shortlisted or rejected
}

export interface HMOpeningListResult {
  data: HMOpeningListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

/**
 * Fetch all openings owned by this hiring manager within their tenant.
 * Uses hiringManagerId === userId filter — the core ownership constraint.
 */
export async function fetchMyOpenings(
  userId: string,
  tenantId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<HMOpeningListResult> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * safePageSize;

  const where = { tenantId, hiringManagerId: userId };

  const [openings, total] = await prisma.$transaction([
    prisma.opening.findMany({
      where,
      skip,
      take: safePageSize,
      orderBy: { postedDate: "desc" },
      select: {
        id: true,
        title: true,
        location: true,
        contractType: true,
        status: true,
        postedDate: true,
        expectedCompletionDate: true,
        experienceMin: true,
        experienceMax: true,
      },
    }),
    prisma.opening.count({ where }),
  ]);

  // Batch-fetch profile counts per opening
  const openingIds = openings.map((o) => o.id);
  const profileCounts = await prisma.hiringProfile.groupBy({
    by: ["openingId"],
    where: { openingId: { in: openingIds }, isDeleted: false },
    _count: { id: true },
  });
  const profileCountMap = new Map(profileCounts.map((c) => [c.openingId, c._count.id]));

  // Pending = not SHORTLISTED and not REJECTED
  const pendingCounts = await prisma.hiringProfile.groupBy({
    by: ["openingId"],
    where: {
      openingId: { in: openingIds },
      isDeleted: false,
      status: "SUBMITTED",
    },
    _count: { id: true },
  });
  const pendingCountMap = new Map(pendingCounts.map((c) => [c.openingId, c._count.id]));

  const data: HMOpeningListItem[] = openings.map((o) => ({
    ...o,
    totalProfiles: profileCountMap.get(o.id) ?? 0,
    pendingReview: pendingCountMap.get(o.id) ?? 0,
  }));

  return {
    data,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  };
}
