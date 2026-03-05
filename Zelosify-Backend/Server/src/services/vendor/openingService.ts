import prisma from "../../config/prisma/prisma.js";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;

export interface OpeningListItem {
  id: string;
  title: string;
  location: string | null;
  contractType: string | null;
  experienceMin: number;
  experienceMax: number | null;
  postedDate: Date;
  status: string;
  hiringManagerName: string;
}

export interface OpeningListResult {
  data: OpeningListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProfileSummary {
  id: number;
  s3Key: string;
  submittedAt: Date;
  status: string;
  uploadedBy: string;
}

export interface OpeningDetail {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  contractType: string | null;
  experienceMin: number;
  experienceMax: number | null;
  postedDate: Date;
  expectedCompletionDate: Date | null;
  status: string;
  hiringManagerName: string;
  profilesCount: number;
  profiles: ProfileSummary[];
}

/**
 * Fetch paginated openings for a tenant — visible to IT_VENDORs.
 * Only returns OPEN openings so vendors don't see closed/on-hold positions.
 */
export async function fetchOpenings(
  tenantId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<OpeningListResult> {
  const safePageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(page, 1);
  const skip = (safePage - 1) * safePageSize;

  const [openings, total] = await prisma.$transaction([
    prisma.opening.findMany({
      where: { tenantId, status: "OPEN" },
      skip,
      take: safePageSize,
      orderBy: { postedDate: "desc" },
      select: {
        id: true,
        title: true,
        location: true,
        contractType: true,
        experienceMin: true,
        experienceMax: true,
        postedDate: true,
        status: true,
        hiringManagerId: true,
      },
    }),
    prisma.opening.count({ where: { tenantId, status: "OPEN" } }),
  ]);

  // Batch-fetch hiring manager names
  const hmIds = [...new Set(openings.map((o) => o.hiringManagerId))];
  const managers = await prisma.user.findMany({
    where: { id: { in: hmIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const managerMap = new Map(
    managers.map((m) => [m.id, `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim()])
  );

  const data: OpeningListItem[] = openings.map((o) => ({
    id: o.id,
    title: o.title,
    location: o.location,
    contractType: o.contractType,
    experienceMin: o.experienceMin,
    experienceMax: o.experienceMax,
    postedDate: o.postedDate,
    status: o.status,
    hiringManagerName: managerMap.get(o.hiringManagerId) ?? "Unknown",
  }));

  return {
    data,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize),
  };
}

/**
 * Fetch a single opening's full detail for a vendor.
 * Returns hiring manager name, experience range, and the vendor's own
 * non-deleted profiles for this opening.
 */
export async function fetchOpeningDetail(
  openingId: string,
  tenantId: string,
  vendorId: string
): Promise<OpeningDetail | null> {
  const opening = await prisma.opening.findFirst({
    where: { id: openingId, tenantId },
    include: {
      hiringProfiles: {
        where: { uploadedBy: vendorId, isDeleted: false },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          s3Key: true,
          submittedAt: true,
          status: true,
          uploadedBy: true,
        },
      },
    },
  });

  if (!opening) return null;

  const manager = await prisma.user.findUnique({
    where: { id: opening.hiringManagerId },
    select: { firstName: true, lastName: true },
  });

  const totalProfilesCount = await prisma.hiringProfile.count({
    where: { openingId, isDeleted: false },
  });

  return {
    id: opening.id,
    title: opening.title,
    description: opening.description,
    location: opening.location,
    contractType: opening.contractType,
    experienceMin: opening.experienceMin,
    experienceMax: opening.experienceMax,
    postedDate: opening.postedDate,
    expectedCompletionDate: opening.expectedCompletionDate,
    status: opening.status,
    hiringManagerName: manager
      ? `${manager.firstName ?? ""} ${manager.lastName ?? ""}`.trim()
      : "Unknown",
    profilesCount: totalProfilesCount,
    profiles: opening.hiringProfiles,
  };
}
