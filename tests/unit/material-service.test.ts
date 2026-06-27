import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSignedMaterialUrl } from "@/lib/integrations/supabase-storage-adapter";
import {
  createMaterialRepository,
  findCourseForMaterialUploadRepository,
  getReadableMaterialRepository,
} from "@/lib/repositories/material-repository";
import { createUploadIntent, getReadableMaterial, registerUploadedMaterial } from "@/lib/services/material-service";

vi.mock("@/lib/integrations/supabase-storage-adapter", () => ({
  createSignedMaterialUrl: vi.fn(),
}));

vi.mock("@/lib/repositories/material-repository", () => ({
  createMaterialRepository: vi.fn(),
  findCourseForMaterialUploadRepository: vi.fn(),
  getReadableMaterialRepository: vi.fn(),
}));

const mockedCreateSignedMaterialUrl = vi.mocked(createSignedMaterialUrl);
const mockedCreateMaterialRepository = vi.mocked(createMaterialRepository);
const mockedFindCourseForMaterialUploadRepository = vi.mocked(findCourseForMaterialUploadRepository);
const mockedGetReadableMaterialRepository = vi.mocked(getReadableMaterialRepository);

describe("material-service", () => {
  beforeEach(() => {
    mockedCreateSignedMaterialUrl.mockReset();
    mockedCreateMaterialRepository.mockReset();
    mockedFindCourseForMaterialUploadRepository.mockReset();
    mockedGetReadableMaterialRepository.mockReset();
  });

  it("returns validation error for unsupported file type", async () => {
    const result = await createUploadIntent({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      fileName: "lesson.txt",
      fileType: "text/plain",
      fileSize: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(mockedFindCourseForMaterialUploadRepository).not.toHaveBeenCalled();
  });

  it("returns forbidden for student role", async () => {
    const result = await createUploadIntent({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "student",
      fileName: "lecture-01.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockedFindCourseForMaterialUploadRepository).not.toHaveBeenCalled();
  });

  it("returns not found when actor cannot upload to course", async () => {
    mockedFindCourseForMaterialUploadRepository.mockResolvedValue(null);

    const result = await createUploadIntent({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      fileName: "lecture-01.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns conflict when course is archived", async () => {
    mockedFindCourseForMaterialUploadRepository.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      ownerId: "22222222-2222-4222-8222-222222222222",
      status: "archived",
    });

    const result = await createUploadIntent({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      fileName: "lecture-01.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.field).toBe("courseId");
    }
  });

  it("creates upload intent with sanitized filename and private storage path", async () => {
    mockedFindCourseForMaterialUploadRepository.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      ownerId: "22222222-2222-4222-8222-222222222222",
      status: "active",
    });

    const result = await createUploadIntent({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      fileName: "Bai Giang Ch.1 (Final).PDF",
      fileType: "application/pdf",
      fileSize: 2048,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.storageBucket).toBe("course-materials");
      expect(result.data.fileName).toBe("bai-giang-ch-1-final.pdf");
      expect(result.data.storagePath.startsWith("11111111-1111-4111-8111-111111111111/")).toBe(true);
      expect(result.data.storagePath.endsWith("/bai-giang-ch-1-final.pdf")).toBe(true);
    }
  });

  it("maps repository failures to unknown error", async () => {
    mockedFindCourseForMaterialUploadRepository.mockRejectedValue(new Error("db down"));

    const result = await createUploadIntent({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "admin",
      fileName: "lecture-01.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_ERROR");
    }
  });

  it("registers uploaded material metadata for authorized teacher", async () => {
    mockedFindCourseForMaterialUploadRepository.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      ownerId: "22222222-2222-4222-8222-222222222222",
      status: "active",
    });
    mockedCreateMaterialRepository.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      courseId: "11111111-1111-4111-8111-111111111111",
      uploadedBy: "22222222-2222-4222-8222-222222222222",
      categoryId: null,
      title: "Slide tuan 1",
      description: "Mo ta",
      sectionLabel: "Tuan 1",
      tags: [],
      fileName: "slide-tuan-1.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      storageBucket: "course-materials",
      storagePath: "11111111-1111-4111-8111-111111111111/intent-id/slide-tuan-1.pdf",
      allowDownload: true,
      sortOrder: 0,
      status: "published",
      reviewStatus: "pending_review",
      reviewNote: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await registerUploadedMaterial({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      title: "Slide tuan 1",
      description: "Mo ta",
      sectionLabel: "Tuan 1",
      storageBucket: "course-materials",
      storagePath: "11111111-1111-4111-8111-111111111111/intent-id/slide-tuan-1.pdf",
      fileName: "slide-tuan-1.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      allowDownload: true,
      reviewStatus: "pending_review",
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateMaterialRepository).toHaveBeenCalledWith({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      categoryId: undefined,
      title: "Slide tuan 1",
      description: "Mo ta",
      sectionLabel: "Tuan 1",
      tags: undefined,
      storageBucket: "course-materials",
      storagePath: "11111111-1111-4111-8111-111111111111/intent-id/slide-tuan-1.pdf",
      fileName: "slide-tuan-1.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      allowDownload: true,
      reviewStatus: "pending_review",
    });
  });

  it("rejects metadata registration when storage path is outside course namespace", async () => {
    const result = await registerUploadedMaterial({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      title: "Slide tuan 1",
      storageBucket: "course-materials",
      storagePath: "other-course/intent-id/slide-tuan-1.pdf",
      fileName: "slide-tuan-1.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      allowDownload: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.field).toBe("storagePath");
    }
    expect(mockedFindCourseForMaterialUploadRepository).not.toHaveBeenCalled();
  });

  it("rejects metadata registration for archived course", async () => {
    mockedFindCourseForMaterialUploadRepository.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      ownerId: "22222222-2222-4222-8222-222222222222",
      status: "archived",
    });

    const result = await registerUploadedMaterial({
      courseId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      title: "Slide tuan 1",
      storageBucket: "course-materials",
      storagePath: "11111111-1111-4111-8111-111111111111/intent-id/slide-tuan-1.pdf",
      fileName: "slide-tuan-1.pdf",
      fileType: "application/pdf",
      fileSize: 1024,
      allowDownload: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
    expect(mockedCreateMaterialRepository).not.toHaveBeenCalled();
  });

  it("returns readable material with download url when allowDownload is true", async () => {
    mockedGetReadableMaterialRepository.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      courseId: "11111111-1111-4111-8111-111111111111",
      title: "Slide tuan 1",
      fileType: "application/pdf",
      storageBucket: "course-materials",
      storagePath: "11111111-1111-4111-8111-111111111111/intent-id/slide-tuan-1.pdf",
      allowDownload: true,
      status: "published",
      reviewStatus: "approved",
    });
    mockedCreateSignedMaterialUrl
      .mockResolvedValueOnce({ ok: true, data: "https://local.test/view" })
      .mockResolvedValueOnce({ ok: true, data: "https://local.test/download" });

    const result = await getReadableMaterial({
      materialId: "33333333-3333-4333-8333-333333333333",
      actorId: "44444444-4444-4444-8444-444444444444",
      actorRole: "student",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.viewUrl).toBe("https://local.test/view");
      expect(result.data.downloadUrl).toBe("https://local.test/download");
      expect(result.data.allowDownload).toBe(true);
    }
  });

  it("omits download url when allowDownload is false", async () => {
    mockedGetReadableMaterialRepository.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      courseId: "11111111-1111-4111-8111-111111111111",
      title: "Slide tuan 1",
      fileType: "application/pdf",
      storageBucket: "course-materials",
      storagePath: "11111111-1111-4111-8111-111111111111/intent-id/slide-tuan-1.pdf",
      allowDownload: false,
      status: "published",
      reviewStatus: "approved",
    });
    mockedCreateSignedMaterialUrl.mockResolvedValueOnce({ ok: true, data: "https://local.test/view" });

    const result = await getReadableMaterial({
      materialId: "33333333-3333-4333-8333-333333333333",
      actorId: "44444444-4444-4444-8444-444444444444",
      actorRole: "student",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.downloadUrl).toBeUndefined();
      expect(result.data.allowDownload).toBe(false);
    }
    expect(mockedCreateSignedMaterialUrl).toHaveBeenCalledTimes(1);
  });

  it("blocks student when material is not published", async () => {
    mockedGetReadableMaterialRepository.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      courseId: "11111111-1111-4111-8111-111111111111",
      title: "Slide tuan 1",
      fileType: "application/pdf",
      storageBucket: "course-materials",
      storagePath: "11111111-1111-4111-8111-111111111111/intent-id/slide-tuan-1.pdf",
      allowDownload: true,
      status: "draft",
      reviewStatus: "approved",
    });

    const result = await getReadableMaterial({
      materialId: "33333333-3333-4333-8333-333333333333",
      actorId: "44444444-4444-4444-8444-444444444444",
      actorRole: "student",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
    expect(mockedCreateSignedMaterialUrl).not.toHaveBeenCalled();
  });
});
