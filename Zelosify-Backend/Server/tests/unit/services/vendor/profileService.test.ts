import { describe, it, expect, vi, beforeEach } from "vitest";

const TENANT_ID = "bruce-wayne-corp-tenant-id-001";
const VENDOR_ID = "vendor-001";
const OPENING_ID = "opening-001";

// ── softDeleteProfile ─────────────────────────────────────────────────────────
describe("softDeleteProfile", () => {
  beforeEach(() => vi.resetModules());

  it("soft-deletes a profile the vendor owns", async () => {
    const updateMock = vi.fn().mockResolvedValue({});
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: 1, status: "SUBMITTED" }),
          update: updateMock,
        },
      },
    }));
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {},
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {},
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));

    const { softDeleteProfile } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    await softDeleteProfile(1, VENDOR_ID, TENANT_ID);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isDeleted: true },
    });
  });

  it("throws when profile is not found or already deleted", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
      },
    }));
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {},
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {},
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));

    const { softDeleteProfile } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    await expect(softDeleteProfile(999, VENDOR_ID, TENANT_ID)).rejects.toThrow(
      "Profile not found or already deleted"
    );
  });

  it("throws when profile is already SHORTLISTED", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        hiringProfile: {
          findFirst: vi.fn().mockResolvedValue({ id: 1, status: "SHORTLISTED" }),
          update: vi.fn(),
        },
      },
    }));
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {},
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {},
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));

    const { softDeleteProfile } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    await expect(softDeleteProfile(1, VENDOR_ID, TENANT_ID)).rejects.toThrow(
      "Cannot delete a shortlisted profile"
    );
  });
});

// ── submitProfiles ────────────────────────────────────────────────────────────
describe("submitProfiles", () => {
  beforeEach(() => vi.resetModules());

  it("throws when opening is not found", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    }));
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {},
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {
        uploadFile = vi.fn();
      },
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));

    const { submitProfiles } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    await expect(
      submitProfiles(OPENING_ID, TENANT_ID, VENDOR_ID, [])
    ).rejects.toThrow("Opening not found");
  });

  it("throws when opening is not OPEN", async () => {
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID, status: "CLOSED" }),
        },
      },
    }));
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {},
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {
        uploadFile = vi.fn();
      },
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));

    const { submitProfiles } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    await expect(
      submitProfiles(OPENING_ID, TENANT_ID, VENDOR_ID, [
        { uploadToken: "tok", fileBuffer: Buffer.from(""), mimeType: "application/pdf", originalName: "cv.pdf" },
      ])
    ).rejects.toThrow("not accepting profiles");
  });

  it("creates DB records in a transaction when S3 upload succeeds", async () => {
    const createMock = vi.fn().mockResolvedValue({
      id: 1,
      s3Key: `${TENANT_ID}/${OPENING_ID}/ts_cv.pdf`,
      submittedAt: new Date(),
      status: "SUBMITTED",
    });
    const transactionMock = vi.fn().mockImplementation(async (ops) =>
      Promise.all(ops)
    );

    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({
      default: {
        opening: {
          findFirst: vi.fn().mockResolvedValue({ id: OPENING_ID, status: "OPEN" }),
        },
        hiringProfile: { create: createMock },
        $transaction: transactionMock,
      },
    }));
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {},
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {
        uploadFile = vi.fn().mockResolvedValue({
          key: `${TENANT_ID}/${OPENING_ID}/ts_cv.pdf`,
          filename: "cv.pdf",
          success: true,
        });
      },
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));

    const { submitProfiles } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    const result = await submitProfiles(OPENING_ID, TENANT_ID, VENDOR_ID, [
      {
        uploadToken: "encrypted-tok",
        fileBuffer: Buffer.from("pdf content"),
        mimeType: "application/pdf",
        originalName: "cv.pdf",
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
    expect(transactionMock).toHaveBeenCalledOnce();
  });
});

// ── presignProfileUploads ─────────────────────────────────────────────────────
describe("presignProfileUploads", () => {
  beforeEach(() => vi.resetModules());

  it("throws when no filenames provided", async () => {
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {
        generateUploadTokens = vi.fn();
      },
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {},
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({ default: {} }));

    const { presignProfileUploads } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    await expect(
      presignProfileUploads(OPENING_ID, TENANT_ID, [], "http://localhost:5000/api/v1/vendor")
    ).rejects.toThrow("At least one filename is required");
  });

  it("calls generateUploadTokens with correct S3 path segments", async () => {
    const generateMock = vi.fn().mockResolvedValue([
      { filename: "cv.pdf", uploadToken: "tok", uploadEndpoint: "/upload" },
    ]);
    vi.doMock("../../../../src/services/upload/filePresignService.js", () => ({
      FilePresignService: class {
        generateUploadTokens = generateMock;
      },
    }));
    vi.doMock("../../../../src/services/upload/fileUploadService.js", () => ({
      FileUploadService: class {},
    }));
    vi.doMock("../../../../src/services/storage/storageFactory.js", () => ({
      createStorageService: vi.fn(),
    }));
    vi.doMock("../../../../src/config/prisma/prisma.js", () => ({ default: {} }));

    const { presignProfileUploads } = await import(
      "../../../../src/services/vendor/profileService.js"
    );
    const result = await presignProfileUploads(
      OPENING_ID,
      TENANT_ID,
      ["cv.pdf"],
      "http://localhost:5000/api/v1/vendor"
    );

    expect(generateMock).toHaveBeenCalledWith(
      ["cv.pdf"],
      expect.objectContaining({
        tenantId: TENANT_ID,
        s3KeyConfig: expect.objectContaining({
          pathSegments: [TENANT_ID, OPENING_ID],
          includeTimestamp: true,
        }),
      })
    );
    expect(result.tokens).toHaveLength(1);
  });
});
