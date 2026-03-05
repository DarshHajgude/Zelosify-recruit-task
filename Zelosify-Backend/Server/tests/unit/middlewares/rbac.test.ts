import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../../../src/types/typeIndex.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal AuthenticatedRequest mock */
function mockReq(
  overrides: Partial<AuthenticatedRequest> = {}
): AuthenticatedRequest {
  return {
    headers: {},
    cookies: {},
    params: {},
    ...overrides,
  } as AuthenticatedRequest;
}

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function mockNext(): NextFunction {
  return vi.fn() as NextFunction;
}

const TENANT_ID = "bruce-wayne-corp-tenant-id-001";
const USER_ID = "user-hm-001";
const OPENING_ID = "opening-001";
const PROFILE_ID = 1;

// ── requireTenant ─────────────────────────────────────────────────────────────

describe("requireTenant middleware", () => {
  // Import inside describe so vi.mock is in scope
  let requireTenant: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => void;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import(
      "../../../src/middlewares/auth/tenantMiddleware.js"
    );
    requireTenant = mod.requireTenant;
  });

  it("calls next() when user has tenant", () => {
    const req = mockReq({
      user: {
        id: USER_ID,
        email: "bruce@test.com",
        username: "bruce",
        role: "HIRING_MANAGER",
        department: "Engineering",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    requireTenant(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when req.user is not populated", () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    const next = mockNext();

    requireTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Authentication") })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when user has no tenant", () => {
    const req = mockReq({
      user: {
        id: USER_ID,
        email: "ghost@test.com",
        username: "ghost",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: null as any,  // no tenant
      },
    });
    const res = mockRes();
    const next = mockNext();

    requireTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when tenant object exists but tenantId is empty string", () => {
    const req = mockReq({
      user: {
        id: USER_ID,
        email: "ghost@test.com",
        username: "ghost",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: "", companyName: "" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    requireTenant(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── getTenantId / getUserId helpers ──────────────────────────────────────────

describe("getTenantId helper", () => {
  it("returns tenantId from req.user.tenant", async () => {
    const { getTenantId } = await import(
      "../../../src/middlewares/auth/tenantMiddleware.js"
    );
    const req = mockReq({
      user: {
        id: USER_ID,
        email: "x@test.com",
        username: "x",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    expect(getTenantId(req)).toBe(TENANT_ID);
  });

  it("throws when tenant is missing", async () => {
    const { getTenantId } = await import(
      "../../../src/middlewares/auth/tenantMiddleware.js"
    );
    const req = mockReq({ user: undefined });
    expect(() => getTenantId(req)).toThrow();
  });
});

describe("getUserId helper", () => {
  it("returns id from req.user", async () => {
    const { getUserId } = await import(
      "../../../src/middlewares/auth/tenantMiddleware.js"
    );
    const req = mockReq({
      user: {
        id: USER_ID,
        email: "x@test.com",
        username: "x",
        role: "HIRING_MANAGER",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    expect(getUserId(req)).toBe(USER_ID);
  });

  it("throws when user is missing", async () => {
    const { getUserId } = await import(
      "../../../src/middlewares/auth/tenantMiddleware.js"
    );
    const req = mockReq({ user: undefined });
    expect(() => getUserId(req)).toThrow();
  });
});

// ── requireOpeningOwnership ───────────────────────────────────────────────────

describe("requireOpeningOwnership middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls next() when user owns the opening in their tenant", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findFirst: vi.fn().mockResolvedValue({
            id: OPENING_ID,
            hiringManagerId: USER_ID,
          }),
        },
      },
    }));

    const { requireOpeningOwnership } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { openingId: OPENING_ID },
      user: {
        id: USER_ID,
        email: "hm@test.com",
        username: "hm",
        role: "HIRING_MANAGER",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireOpeningOwnership(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 404 when opening not found in tenant", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    }));

    const { requireOpeningOwnership } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { openingId: "nonexistent" },
      user: {
        id: USER_ID,
        email: "hm@test.com",
        username: "hm",
        role: "HIRING_MANAGER",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireOpeningOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when opening belongs to a different hiring manager", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findFirst: vi.fn().mockResolvedValue({
            id: OPENING_ID,
            hiringManagerId: "some-other-manager-id",
          }),
        },
      },
    }));

    const { requireOpeningOwnership } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { openingId: OPENING_ID },
      user: {
        id: USER_ID,
        email: "hm@test.com",
        username: "hm",
        role: "HIRING_MANAGER",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireOpeningOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when openingId is missing from params", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn() },
      },
    }));

    const { requireOpeningOwnership } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: {},   // no openingId
      user: {
        id: USER_ID,
        email: "hm@test.com",
        username: "hm",
        role: "HIRING_MANAGER",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireOpeningOwnership(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── requireProfileUploader ────────────────────────────────────────────────────

describe("requireProfileUploader middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("calls next() when vendor uploaded the profile in their tenant", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({
            id: PROFILE_ID,
            uploadedBy: USER_ID,
          }),
        },
      },
    }));

    const { requireProfileUploader } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { profileId: String(PROFILE_ID) },
      user: {
        id: USER_ID,
        email: "vendor@test.com",
        username: "vendor1",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireProfileUploader(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 403 when a different vendor tries to access the profile", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({
            id: PROFILE_ID,
            uploadedBy: "another-vendor-id",
          }),
        },
      },
    }));

    const { requireProfileUploader } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { profileId: String(PROFILE_ID) },
      user: {
        id: USER_ID,
        email: "vendor@test.com",
        username: "vendor1",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireProfileUploader(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when profile not found in tenant", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
    }));

    const { requireProfileUploader } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { profileId: "999" },
      user: {
        id: USER_ID,
        email: "vendor@test.com",
        username: "vendor1",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireProfileUploader(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 400 when profileId is not a number", async () => {
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: { findFirst: vi.fn() },
      },
    }));

    const { requireProfileUploader } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { profileId: "not-a-number" },
      user: {
        id: USER_ID,
        email: "vendor@test.com",
        username: "vendor1",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });
    const res = mockRes();
    const next = mockNext();

    await requireProfileUploader(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── Tenant isolation: cross-tenant leakage prevention ─────────────────────────

describe("Tenant isolation", () => {
  it("requireOpeningOwnership queries with tenantId filter to prevent cross-tenant access", async () => {
    vi.resetModules();

    const findFirstMock = vi.fn().mockResolvedValue(null);
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: findFirstMock },
      },
    }));

    const { requireOpeningOwnership } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { openingId: OPENING_ID },
      user: {
        id: USER_ID,
        email: "hm@test.com",
        username: "hm",
        role: "HIRING_MANAGER",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });

    await requireOpeningOwnership(req, mockRes(), mockNext());

    // The DB query must include tenantId so a different tenant's opening is never returned
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: TENANT_ID }),
      })
    );
  });

  it("requireProfileUploader queries via opening.tenantId to prevent cross-tenant access", async () => {
    vi.resetModules();

    const findFirstMock = vi.fn().mockResolvedValue(null);
    vi.doMock("../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: { findFirst: findFirstMock },
      },
    }));

    const { requireProfileUploader } = await import(
      "../../../src/middlewares/auth/ownershipMiddleware.js"
    );

    const req = mockReq({
      params: { profileId: "1" },
      user: {
        id: USER_ID,
        email: "vendor@test.com",
        username: "vendor1",
        role: "IT_VENDOR",
        department: "",
        provider: "KEYCLOAK",
        tenant: { tenantId: TENANT_ID, companyName: "Bruce Wayne Corp" },
      },
    });

    await requireProfileUploader(req, mockRes(), mockNext());

    // The query must scope to tenant via the opening relation
    expect(findFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          opening: expect.objectContaining({ tenantId: TENANT_ID }),
        }),
      })
    );
  });
});
