import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listLibraryCategoriesRepository,
  listLibraryChangeRequestsRepository,
  listLibraryMaterialsRepository,
  listLibrarySimulationUploadsRepository,
  listLibrarySimulationsRepository,
} from "@/lib/repositories/library-repository";
import { getLibraryOverview } from "@/lib/services/library-service";

vi.mock("@/lib/repositories/library-repository", () => ({
  listLibraryCategoriesRepository: vi.fn(),
  listLibraryChangeRequestsRepository: vi.fn(),
  listLibraryMaterialsRepository: vi.fn(),
  listLibrarySimulationUploadsRepository: vi.fn(),
  listLibrarySimulationsRepository: vi.fn(),
}));

const mockedListLibraryCategoriesRepository = vi.mocked(listLibraryCategoriesRepository);
const mockedListLibraryChangeRequestsRepository = vi.mocked(listLibraryChangeRequestsRepository);
const mockedListLibraryMaterialsRepository = vi.mocked(listLibraryMaterialsRepository);
const mockedListLibrarySimulationUploadsRepository = vi.mocked(listLibrarySimulationUploadsRepository);
const mockedListLibrarySimulationsRepository = vi.mocked(listLibrarySimulationsRepository);

describe("library-service", () => {
  beforeEach(() => {
    mockedListLibraryCategoriesRepository.mockReset();
    mockedListLibraryChangeRequestsRepository.mockReset();
    mockedListLibraryMaterialsRepository.mockReset();
    mockedListLibrarySimulationUploadsRepository.mockReset();
    mockedListLibrarySimulationsRepository.mockReset();
  });

  it("returns library overview with VL6 integration review", async () => {
    mockedListLibraryCategoriesRepository.mockResolvedValueOnce([]);
    mockedListLibraryMaterialsRepository.mockResolvedValueOnce([
      {
        id: "material-1",
        courseId: "course-1",
        uploadedBy: "teacher-1",
        courseCode: "PHY6",
        courseTitle: "Vật lý 6",
        categoryId: null,
        categoryName: null,
        title: "Tài liệu chuyển động",
        description: null,
        sectionLabel: null,
        tags: [],
        fileType: "application/pdf",
        fileSize: 1024,
        allowDownload: true,
        status: "published",
        reviewStatus: "approved",
        reviewNote: null,
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ]);
    mockedListLibrarySimulationsRepository.mockResolvedValueOnce([]);
    mockedListLibraryChangeRequestsRepository.mockResolvedValueOnce([]);
    mockedListLibrarySimulationUploadsRepository.mockResolvedValueOnce([
      {
        id: "upload-1",
        uploadedBy: "teacher-1",
        categoryId: null,
        categoryName: null,
        title: "Mô phỏng VL6",
        description: null,
        originalFileName: "mo-phong-vl6.html",
        fileType: "text/html",
        fileSize: 2048,
        tags: [],
        requestedCourseId: null,
        requestedCourseCode: null,
        requestedCourseTitle: null,
        reviewStatus: "pending_review",
        nativeIntegrationStatus: "not_requested",
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
        createdAt: "2026-06-04T00:00:00.000Z",
      },
    ]);

    const result = await getLibraryOverview();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.materials).toHaveLength(1);
      expect(result.data.simulationUploads).toHaveLength(1);
      expect(result.data.changeRequests).toHaveLength(0);
      expect(result.data.vl6IntegrationReview.fileName).toBe("_Mo_phong_VL6.html");
      expect(result.data.vl6IntegrationReview.verdict).toBe("integratable_with_refactor");
      expect(result.data.pendingWorkflow.deletePolicy).toContain("Mod/Admin");
    }
  });

  it("returns structured error when repository fails", async () => {
    mockedListLibraryCategoriesRepository.mockResolvedValueOnce([]);
    mockedListLibraryMaterialsRepository.mockRejectedValueOnce(new Error("database offline"));
    mockedListLibrarySimulationsRepository.mockResolvedValueOnce([]);
    mockedListLibrarySimulationUploadsRepository.mockResolvedValueOnce([]);
    mockedListLibraryChangeRequestsRepository.mockResolvedValueOnce([]);

    const result = await getLibraryOverview();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_ERROR");
      expect(result.error.message).toBe("Không thể tải Thư viện.");
    }
  });
});
