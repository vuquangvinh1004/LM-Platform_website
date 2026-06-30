import { randomUUID } from "crypto";

import {
  archiveLibraryCategoryRepository,
  archiveLibraryResourceRepository,
  createLibraryChangeRequestRepository,
  createSimulationUploadRepository,
  deletePersonalLibraryResourceRepository,
  deleteLibraryResourceRepository,
  getLibraryChangeRequestByIdRepository,
  getLibraryResourceSnapshotRepository,
  getSimulationUploadByIdRepository,
  hasVisiblePublishedSimulationForUploadRepository,
  linkSimulationUploadToCourseRepository,
  listLibraryCategoriesRepository,
  listLibraryChangeRequestsRepository,
  listLibraryMaterialsRepository,
  listLibrarySimulationUploadsRepository,
  listLibrarySimulationsRepository,
  requestNativeSimulationIntegrationRepository,
  reviewNativeSimulationIntegrationRepository,
  reviewLibraryChangeRequestRepository,
  reviewMaterialRepository,
  reviewSimulationUploadRepository,
  upsertLibraryCategoryRepository,
} from "@/lib/repositories/library-repository";
import {
  archiveGlobalNotificationsByRelatedEntityRepository,
  createGlobalNotificationRepository,
} from "@/lib/repositories/global-notification-repository";
import { findCourseForMaterialUploadRepository } from "@/lib/repositories/material-repository";
import { ensureTeacherPersonalLibraryCapacity, getTeacherPersonalLibrarySnapshot } from "@/lib/services/personal-library-service";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/auth";
import type {
  LibraryChangeRequestItem,
  LibraryChangeRequestTargetType,
  LibraryCategoryItem,
  LibraryMaterialItem,
  LibraryOverview,
  LibrarySimulationItem,
  LibrarySimulationUploadItem,
} from "@/lib/types/library";
import type { ServiceResult } from "@/lib/types/service-result";

const SIMULATION_STORAGE_BUCKET = "simulation-packages";
const MAX_LIBRARY_UPLOAD_SIZE_BYTES = 19 * 1024 * 1024;

export type SimulationUploadIntent = {
  storageBucket: "simulation-packages";
  storagePath: string;
  fileName: string;
  fileType: "text/html";
  fileSize: number;
};

export type CreateSimulationUploadIntentInput = {
  actorId: string;
  actorRole: UserRole;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export type RegisterSimulationUploadInput = CreateSimulationUploadIntentInput & {
  categoryId?: string;
  courseId?: string;
  title: string;
  description?: string;
  tags?: string[];
  storageBucket: "simulation-packages";
  storagePath: string;
};

export type ReviewSimulationUploadInput = {
  uploadId: string;
  actorId: string;
  actorRole: UserRole;
  reviewStatus: "approved" | "rejected";
  reviewNote?: string;
};

export type ReviewMaterialInput = {
  materialId: string;
  actorId: string;
  actorRole: UserRole;
  reviewStatus: "approved" | "rejected";
  reviewNote?: string;
};

export type LinkSimulationUploadToCourseInput = {
  uploadId: string;
  courseId: string;
  actorId: string;
  actorRole: UserRole;
};

export type RequestNativeSimulationIntegrationInput = {
  uploadId: string;
  actorId: string;
  actorRole: UserRole;
};

export type ReviewNativeSimulationIntegrationInput = {
  uploadId: string;
  actorId: string;
  actorRole: UserRole;
  nativeIntegrationStatus: "accepted" | "rejected";
  reviewNote?: string;
};

export type GetSimulationUploadOpenUrlInput = {
  uploadId: string;
  actorId: string;
  actorRole: UserRole;
};

export type CreateLibraryArchiveRequestInput = {
  targetType: LibraryChangeRequestTargetType;
  targetId: string;
  action: "archive" | "delete";
  actorId: string;
  actorRole: UserRole;
  reason?: string;
};

export type ReviewLibraryArchiveRequestInput = {
  requestId: string;
  actorId: string;
  actorRole: UserRole;
  status: "approved" | "rejected";
  reviewNote?: string;
};

export type ApplyAdminLibraryResourceActionInput = {
  targetType: LibraryChangeRequestTargetType;
  targetId: string;
  action: "archive" | "delete";
  actorRole: UserRole;
};

export type DeletePersonalLibraryResourceInput = {
  targetType: "material" | "simulation_upload";
  targetId: string;
  actorId: string;
  actorRole: UserRole;
};

export type UpsertLibraryCategoryInput = {
  categoryId?: string;
  actorId: string;
  actorRole: UserRole;
  name: string;
  description?: string;
  sortOrder?: number;
};

export type ArchiveLibraryCategoryInput = {
  categoryId: string;
  actorId: string;
  actorRole: UserRole;
};

function normalizeRepositoryError(error: unknown): { message: string; code?: string } {
  if (error instanceof Error) {
    return { message: error.message };
  }

  if (error && typeof error === "object") {
    const errorLike = error as { message?: unknown; code?: unknown };
    return {
      message: typeof errorLike.message === "string" ? errorLike.message : "Unknown repository error",
      code: typeof errorLike.code === "string" ? errorLike.code : undefined,
    };
  }

  return { message: "Unknown repository error" };
}

function sanitizeFileName(fileName: string): string {
  const trimmedFileName = fileName.trim();
  const nameSegments = trimmedFileName.split(".");

  if (nameSegments.length <= 1) {
    return "simulation.html";
  }

  const extension = nameSegments.pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "html";
  const baseName = nameSegments
    .join(".")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${baseName || "simulation"}.${extension || "html"}`;
}

function isSimulationManager(role: UserRole): boolean {
  return role === "teacher" || role === "moderator" || role === "admin";
}

function isReviewer(role: UserRole): boolean {
  return role === "moderator" || role === "admin";
}

function isLibraryCategoryManager(role: UserRole): boolean {
  return role === "admin";
}

function slugifyCategoryName(name: string): string {
  return name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function parseLibraryTags(tagsText: string): string[] {
  return [
    ...new Set(
      tagsText
        .split(";")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40)),
    ),
  ].slice(0, 20);
}

function uniqueLibrarySimulations(simulations: LibrarySimulationItem[]): LibrarySimulationItem[] {
  const seen = new Set<string>();

  return simulations.filter((simulation) => {
    const key = `${simulation.slug}:${simulation.title.trim().toLowerCase()}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isMissingMigration(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    error.message.includes("simulation_uploads") ||
    error.message.includes("simulation-packages")
  );
}

/**
 * Returns the library overview for teachers, moderators, and admins without exposing storage paths.
 */
export async function getLibraryOverview(input?: { actorId: string; actorRole: UserRole }): Promise<ServiceResult<LibraryOverview>> {
  try {
    const [categories, materials, simulations, simulationUploads, changeRequests, personalLibraryResult] = await Promise.all([
      listLibraryCategoriesRepository(),
      listLibraryMaterialsRepository(input),
      listLibrarySimulationsRepository(input),
      listLibrarySimulationUploadsRepository(input),
      listLibraryChangeRequestsRepository(),
      input?.actorRole === "teacher"
        ? getTeacherPersonalLibrarySnapshot(input.actorId)
        : Promise.resolve(null),
    ]);

    const uniqueSimulations = uniqueLibrarySimulations(simulations);

    return {
      ok: true,
      data: {
        categories,
        materials,
        simulations: uniqueSimulations,
        simulationUploads,
        changeRequests,
        personalLibrary:
          personalLibraryResult && personalLibraryResult.ok
            ? {
                quotaBytes: personalLibraryResult.data.quotaBytes,
                usedBytes: personalLibraryResult.data.usedBytes,
                remainingBytes: personalLibraryResult.data.remainingBytes,
              }
            : undefined,
        pendingWorkflow: {
          uploadPolicy:
            "GIẢNG VIÊN và GIÁM SÁT VIÊN vận hành việc tải tài liệu, tải mô phỏng và gắn tài nguyên theo học phần; QUẢN TRỊ VIÊN không còn thực hiện các thao tác này trong Thư viện.",
          linkPolicy:
            "GIẢNG VIÊN gắn hoặc bỏ tài nguyên Thư viện trong từng lớp học phần từ các màn hình nghiệp vụ của lớp và học phần.",
          deletePolicy:
            "Việc duyệt, ẩn/xóa hoặc điều chỉnh tài nguyên được xử lý trong luồng vận hành của GIÁM SÁT VIÊN và GIẢNG VIÊN; QUẢN TRỊ VIÊN chỉ quản lý Danh mục Thư viện dùng chung.",
        },
        vl6IntegrationReview: {
          fileName: "_Mo_phong_VL6.html",
          verdict: "integratable_with_refactor",
          summary:
            "Mô phỏng VL6 có nội dung phù hợp để đưa vào thư viện mô phỏng, nhưng nên chuyển thành React client widget thay vì nhúng nguyên HTML độc lập.",
          risks: [
            "Đang dùng Tailwind CDN và FontAwesome CDN, không phù hợp với build Next.js production hiện tại.",
            "Dùng nhiều inline onclick và hàm global, dễ xung đột khi đặt trong App Router.",
            "Dùng canvas và DOM API trực tiếp, cần đóng gói trong client component với lifecycle rõ ràng.",
            "Bảng màu slate/indigo đậm lệch nhẹ so với _edumanage-lite-docs/DESIGN.md hiện tại, cần map lại token màu/spacing.",
          ],
          recommendedSteps: [
            "Tách logic vật lý thành helper thuần để test được.",
            "Chuyển phần tương tác sang client component trong simulations/widgets.",
            "Thay FontAwesome bằng lucide-react hoặc text/icon sẵn có trong hệ thống.",
            "Đăng ký slug mới trong simulations/registry.ts và seed vào bảng simulations theo học phần.",
          ],
        },
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải Thư viện.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Creates a pending archive/delete request for a library material or simulation.
 */
export async function createLibraryArchiveRequest(
  input: CreateLibraryArchiveRequestInput,
): Promise<ServiceResult<LibraryChangeRequestItem>> {
  if (!isSimulationManager(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền tạo yêu cầu ẩn tài nguyên.",
      },
    };
  }

  if (input.targetType !== "material" && input.targetType !== "simulation") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Loại tài nguyên cần ẩn không hợp lệ.",
        field: "targetType",
      },
    };
  }

  if (input.action !== "archive" && input.action !== "delete") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Thao tác với tài nguyên không hợp lệ.",
        field: "action",
      },
    };
  }

  try {
    const snapshot = await getLibraryResourceSnapshotRepository({
      targetType: input.targetType,
      targetId: input.targetId,
    });

    if (!snapshot) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy tài nguyên hoặc bạn không được phép thao tác.",
        },
      };
    }

    if (snapshot.status === "archived") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Tài nguyên này đã được lưu trữ.",
        },
      };
    }

    const request = await createLibraryChangeRequestRepository({
      targetType: input.targetType,
      targetId: input.targetId,
      action: input.action,
      targetTitleSnapshot: snapshot.title,
      targetCourseLabelSnapshot: snapshot.courseLabel ?? undefined,
      requestedBy: input.actorId,
      reason: input.reason?.trim() || undefined,
    });

    return {
      ok: true,
      data: request,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);
    const isDuplicatePending = normalizedError.code === "23505" || normalizedError.message.includes("duplicate key");

    return {
      ok: false,
      error: {
        code: isDuplicatePending ? "CONFLICT" : "UNKNOWN_ERROR",
        message: isDuplicatePending
          ? "Tài nguyên này đã có yêu cầu ẩn đang chờ duyệt."
          : "Không thể tạo yêu cầu ẩn tài nguyên.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Creates or updates one library category. Only Admin can manage the shared category list.
 */
export async function upsertLibraryCategory(input: UpsertLibraryCategoryInput): Promise<ServiceResult<LibraryCategoryItem>> {
  if (!isLibraryCategoryManager(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được quản lý danh mục Thư viện.",
      },
    };
  }

  const name = input.name.trim();
  const slug = slugifyCategoryName(name);

  if (!name || !slug) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Tên danh mục không hợp lệ.",
        field: "name",
      },
    };
  }

  try {
    const category = await upsertLibraryCategoryRepository({
      categoryId: input.categoryId,
      actorId: input.actorId,
      name,
      slug,
      description: input.description?.trim() || undefined,
      sortOrder: input.sortOrder ?? 0,
    });

    return { ok: true, data: category };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: normalizedError.code === "23505" ? "CONFLICT" : "UNKNOWN_ERROR",
        message:
          normalizedError.code === "23505"
            ? "Danh mục này đã tồn tại."
            : "Không thể lưu danh mục Thư viện.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Archives a category so it no longer appears in new upload/filter choices.
 */
export async function archiveLibraryCategory(input: ArchiveLibraryCategoryInput): Promise<ServiceResult<LibraryCategoryItem>> {
  if (!isLibraryCategoryManager(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được lưu trữ danh mục Thư viện.",
      },
    };
  }

  try {
    const category = await archiveLibraryCategoryRepository(input.categoryId);

    if (!category) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy danh mục cần lưu trữ.",
        },
      };
    }

    return { ok: true, data: category };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lưu trữ danh mục Thư viện.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Reviews an archive/delete request and applies the approved resource change.
 */
export async function reviewLibraryArchiveRequest(
  input: ReviewLibraryArchiveRequestInput,
): Promise<ServiceResult<LibraryChangeRequestItem>> {
  if (!isReviewer(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod/Admin được duyệt yêu cầu ẩn tài nguyên.",
      },
    };
  }

  try {
    const existingRequest = await getLibraryChangeRequestByIdRepository(input.requestId);

    if (!existingRequest) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy yêu cầu cần duyệt.",
        },
      };
    }

    if (existingRequest.status !== "pending_review") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Yêu cầu này đã được xử lý.",
        },
      };
    }

    if (existingRequest.action === "delete" && input.actorRole !== "admin") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Chỉ Admin được duyệt yêu cầu xóa tài nguyên.",
        },
      };
    }

    if (input.status === "approved" && existingRequest.action === "archive") {
      await archiveLibraryResourceRepository({
        targetType: existingRequest.targetType,
        targetId: existingRequest.targetId,
      });
    }

    if (input.status === "approved" && existingRequest.action === "delete") {
      await deleteLibraryResourceRepository({
        targetType: existingRequest.targetType,
        targetId: existingRequest.targetId,
      });
    }

    const reviewedRequest = await reviewLibraryChangeRequestRepository({
      requestId: input.requestId,
      reviewedBy: input.actorId,
      status: input.status,
      reviewNote: input.reviewNote?.trim() || undefined,
    });

    if (!reviewedRequest) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy yêu cầu sau khi duyệt.",
        },
      };
    }

    return {
      ok: true,
      data: reviewedRequest,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể duyệt yêu cầu ẩn tài nguyên.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Applies archive/delete immediately for Admin without creating a review request.
 */
export async function applyAdminLibraryResourceAction(
  input: ApplyAdminLibraryResourceActionInput,
): Promise<ServiceResult<{ applied: true }>> {
  if (input.actorRole !== "admin" && input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ GIÁM SÁT VIÊN hoặc QUẢN TRỊ VIÊN được ẩn hoặc xóa tài nguyên trực tiếp.",
      },
    };
  }

  if (input.targetType !== "material" && input.targetType !== "simulation") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Loại tài nguyên không hợp lệ.",
      },
    };
  }

  try {
    if (input.action === "archive") {
      await archiveLibraryResourceRepository({
        targetType: input.targetType,
        targetId: input.targetId,
      });
    } else if (input.action === "delete") {
      await deleteLibraryResourceRepository({
        targetType: input.targetType,
        targetId: input.targetId,
      });
    } else {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Thao tác tài nguyên không hợp lệ.",
        },
      };
    }

    return {
      ok: true,
      data: { applied: true },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể áp dụng thao tác tài nguyên.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

/**
 * Deletes a teacher-owned personal resource that has not been submitted to the shared library.
 */
export async function deletePersonalLibraryResource(
  input: DeletePersonalLibraryResourceInput,
): Promise<ServiceResult<{ deleted: true }>> {
  if (input.actorRole !== "teacher") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ giảng viên được xóa tài nguyên trong Thư viện cá nhân của mình.",
      },
    };
  }

  if (input.targetType !== "material" && input.targetType !== "simulation_upload") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Loại tài nguyên cá nhân không hợp lệ.",
      },
    };
  }

  try {
    const deleted = await deletePersonalLibraryResourceRepository({
      targetType: input.targetType,
      targetId: input.targetId,
      actorId: input.actorId,
    });

    if (!deleted) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Chỉ có thể xóa tài nguyên cá nhân chưa đưa vào Thư viện dùng chung.",
        },
      };
    }

    return {
      ok: true,
      data: { deleted: true },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể xóa tài nguyên cá nhân.",
        details: normalizeRepositoryError(error).message,
      },
    };
  }
}

/**
 * Reviews whether an uploaded HTML simulation should enter native widget conversion backlog.
 */
export async function reviewNativeSimulationIntegration(
  input: ReviewNativeSimulationIntegrationInput,
): Promise<ServiceResult<LibrarySimulationUploadItem>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được duyệt đề xuất tích hợp native.",
      },
    };
  }

  try {
    const upload = await reviewNativeSimulationIntegrationRepository({
      uploadId: input.uploadId,
      nativeIntegrationStatus: input.nativeIntegrationStatus,
      reviewedBy: input.actorId,
      reviewNote: input.reviewNote?.trim() || undefined,
    });

    if (!upload) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy mô phỏng cần duyệt native.",
        },
      };
    }

    return {
      ok: true,
      data: upload,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể duyệt đề xuất tích hợp native.",
        details: normalizedError.message,
      },
    };
  }
}

export async function reviewMaterial(
  input: ReviewMaterialInput,
): Promise<ServiceResult<{ material: LibraryMaterialItem | null; deleted: boolean }>> {
  if (!isReviewer(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod/Admin được duyệt tài liệu.",
      },
    };
  }

  try {
    const material = await reviewMaterialRepository({
      materialId: input.materialId,
      actorId: input.actorId,
      reviewStatus: input.reviewStatus,
      reviewNote: input.reviewNote?.trim() || undefined,
    });

    if (!material) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy tài liệu cần duyệt.",
        },
      };
    }

    if (material.reviewStatus === "rejected") {
      const supabase = createServiceRoleSupabaseClient();

      if (material.storageBucket && material.storagePath) {
        await supabase.storage.from(material.storageBucket).remove([material.storagePath]);
      }

      const { error: linkError } = await supabase
        .from("class_resource_links")
        .delete()
        .eq("target_type", "material")
        .eq("target_id", input.materialId);

      if (linkError) {
        throw linkError;
      }

      await archiveGlobalNotificationsByRelatedEntityRepository({
        relatedEntityType: "material",
        relatedEntityId: input.materialId,
        kinds: ["material_upload_request"],
      });

      await createGlobalNotificationRepository({
        title: "Tài liệu đã bị từ chối",
        content: `Tài liệu "${material.title}" đã bị từ chối duyệt và được xóa khỏi Thư viện.`,
        createdBy: input.actorId,
        createdByRole: input.actorRole as "admin" | "moderator" | "teacher",
        audienceRoles: [],
        targetProfileIds: [material.uploadedBy],
        kind: "material_upload_result",
        relatedEntityType: "material",
        relatedEntityId: material.id,
      });

      return { ok: true, data: { material: null, deleted: true } };
    }

    await archiveGlobalNotificationsByRelatedEntityRepository({
      relatedEntityType: "material",
      relatedEntityId: input.materialId,
      kinds: ["material_upload_request"],
    });

    await createGlobalNotificationRepository({
      title: "Tài liệu đã được duyệt",
      content: `Tài liệu "${material.title}" đã được duyệt và hiển thị trong Thư viện.`,
      createdBy: input.actorId,
      createdByRole: input.actorRole as "admin" | "moderator" | "teacher",
      audienceRoles: [],
      targetProfileIds: [material.uploadedBy],
      kind: "material_upload_result",
      relatedEntityType: "material",
      relatedEntityId: material.id,
    });

    return { ok: true, data: { material, deleted: false } };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể duyệt tài liệu.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Creates a storage path for one standalone HTML simulation upload.
 */
export async function createSimulationUploadIntent(
  input: CreateSimulationUploadIntentInput,
): Promise<ServiceResult<SimulationUploadIntent>> {
  if (!isSimulationManager(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền tải mô phỏng lên Thư viện.",
      },
    };
  }

  const sanitizedFileName = sanitizeFileName(input.fileName);
  const lowerFileName = sanitizedFileName.toLowerCase();

  if (!lowerFileName.endsWith(".html") && input.fileType !== "text/html") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Hiện tại Thư viện chỉ nhận mô phỏng HTML đơn lẻ ở định dạng .html.",
        field: "file",
      },
    };
  }

  if (input.fileSize <= 0 || input.fileSize > MAX_LIBRARY_UPLOAD_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Tệp mô phỏng HTML phải nhỏ hơn 19 MB.",
        field: "file",
      },
    };
  }

  if (input.actorRole === "teacher") {
    const quotaResult = await ensureTeacherPersonalLibraryCapacity({
      teacherId: input.actorId,
      incomingBytes: input.fileSize,
    });

    if (!quotaResult.ok) {
      return {
        ok: false,
        error: quotaResult.error,
      };
    }
  }

  return {
    ok: true,
    data: {
      storageBucket: SIMULATION_STORAGE_BUCKET,
      storagePath: `${input.actorId}/${randomUUID()}/${sanitizedFileName}`,
      fileName: sanitizedFileName,
      fileType: "text/html",
      fileSize: input.fileSize,
    },
  };
}

/**
 * Registers uploaded HTML simulation metadata as an approved standalone library resource.
 */
export async function registerSimulationUpload(
  input: RegisterSimulationUploadInput,
): Promise<ServiceResult<LibrarySimulationUploadItem>> {
  if (!isSimulationManager(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền đăng ký mô phỏng trong Thư viện.",
      },
    };
  }

  if (!input.title.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Bạn cần nhập tiêu đề mô phỏng.",
        field: "title",
      },
    };
  }

  if (input.actorRole === "admin" && input.courseId) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Admin không gắn mô phỏng HTML vào học phần. Hãy tải vào Thư viện dùng chung không gắn học phần.",
        field: "courseId",
      },
    };
  }

  if (!input.storagePath.startsWith(`${input.actorId}/`)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Đường dẫn lưu trữ mô phỏng không hợp lệ.",
        field: "storagePath",
      },
    };
  }

  try {
    if (input.courseId) {
      const courseRecord = await findCourseForMaterialUploadRepository({
        courseId: input.courseId,
        actorId: input.actorId,
        actorRole: input.actorRole,
      });

      if (!courseRecord || courseRecord.status === "archived") {
        return {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy học phần hoặc bạn không được phép gửi mô phỏng vào học phần này.",
            field: "courseId",
          },
        };
      }
    }

    const upload = await createSimulationUploadRepository({
      actorId: input.actorId,
      categoryId: input.categoryId,
      requestedCourseId: input.courseId,
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      tags: input.tags,
      originalFileName: sanitizeFileName(input.fileName),
      fileType: input.fileType || "text/html",
      fileSize: input.fileSize,
      storageBucket: input.storageBucket,
      storagePath: input.storagePath,
      reviewStatus: input.courseId && input.actorRole === "teacher" ? "pending_review" : "approved",
    });

    return {
      ok: true,
      data: upload,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: isMissingMigration(normalizedError)
          ? "Chưa có bảng hoặc bucket simulation_uploads. Hãy áp dụng migration Supabase mới trước khi tải mô phỏng."
          : "Không thể lưu mô phỏng vào Thư viện.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Approves or rejects a simulation upload.
 */
export async function reviewSimulationUpload(
  input: ReviewSimulationUploadInput,
): Promise<ServiceResult<LibrarySimulationUploadItem>> {
  if (!isReviewer(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod/Admin được duyệt mô phỏng.",
      },
    };
  }

  try {
    const upload = await reviewSimulationUploadRepository({
      uploadId: input.uploadId,
      actorId: input.actorId,
      reviewStatus: input.reviewStatus,
      reviewNote: input.reviewNote,
    });

    if (!upload) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy mô phỏng cần duyệt.",
        },
      };
    }

    if (input.reviewStatus === "approved" && upload.requestedCourseId && input.actorRole === "moderator") {
      await linkSimulationUploadToCourseRepository({
        uploadId: upload.id,
        courseId: upload.requestedCourseId,
        actorId: input.actorId,
        actorRole: input.actorRole,
      });
    }

    return {
      ok: true,
      data: upload,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật trạng thái duyệt mô phỏng.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Links an approved HTML upload to a course by creating a published simulation registry item.
 */
export async function linkSimulationUploadToCourse(
  input: LinkSimulationUploadToCourseInput,
): Promise<ServiceResult<LibrarySimulationItem>> {
  if (input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod được gắn mô phỏng HTML vào học phần.",
      },
    };
  }

  try {
    const upload = await getSimulationUploadByIdRepository(input.uploadId);

    if (!upload) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy mô phỏng đã tải lên.",
        },
      };
    }

    if (upload.reviewStatus !== "approved") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Mô phỏng chưa khả dụng để gắn vào học phần.",
        },
      };
    }

    const courseRecord = await findCourseForMaterialUploadRepository({
      courseId: input.courseId,
      actorId: input.actorId,
      actorRole: input.actorRole,
    });

    if (!courseRecord || courseRecord.status === "archived") {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần hoặc bạn không được phép gắn mô phỏng.",
          field: "courseId",
        },
      };
    }

    const simulation = await linkSimulationUploadToCourseRepository(input);

    return {
      ok: true,
      data: simulation,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: normalizedError.message.includes("public.simulations")
          ? "Chưa có bảng simulations. Hãy áp dụng migration simulation registry trước khi gắn mô phỏng."
          : "Không thể gắn mô phỏng vào học phần.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Requests a later native widget conversion for an uploaded HTML simulation.
 */
export async function requestNativeSimulationIntegration(
  input: RequestNativeSimulationIntegrationInput,
): Promise<ServiceResult<LibrarySimulationUploadItem>> {
  if (input.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Mod được gửi yêu cầu tích hợp native cho mô phỏng HTML.",
      },
    };
  }

  try {
    const upload = await requestNativeSimulationIntegrationRepository(input.uploadId);

    if (!upload) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy mô phỏng cần đề xuất.",
        },
      };
    }

    return {
      ok: true,
      data: upload,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể gửi đề xuất tích hợp native.",
        details: normalizedError.message,
      },
    };
  }
}

/**
 * Returns a short-lived signed URL for an approved HTML simulation.
 */
export async function getSimulationUploadOpenUrl(input: GetSimulationUploadOpenUrlInput): Promise<ServiceResult<string>> {
  try {
    const upload = await getSimulationUploadByIdRepository(input.uploadId);

    if (!upload || upload.reviewStatus !== "approved") {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy mô phỏng hoặc mô phỏng chưa được duyệt.",
        },
      };
    }

    const canOpenDirectly = input.actorRole === "admin" || input.actorRole === "moderator" || upload.uploadedBy === input.actorId;
    const hasVisibleLinkedSimulation = await hasVisiblePublishedSimulationForUploadRepository(input.uploadId);

    if (!canOpenDirectly && !hasVisibleLinkedSimulation) {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Bạn không có quyền mở mô phỏng này.",
        },
      };
    }

    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase.storage.from(upload.storageBucket).createSignedUrl(upload.storagePath, 60 * 10);

    if (error || !data?.signedUrl) {
      return {
        ok: false,
        error: {
          code: "STORAGE_ERROR",
          message: "Không thể tạo liên kết mở mô phỏng.",
          details: error?.message,
        },
      };
    }

    return {
      ok: true,
      data: data.signedUrl,
    };
  } catch (error) {
    const normalizedError = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể mở mô phỏng.",
        details: normalizedError.message,
      },
    };
  }
}
