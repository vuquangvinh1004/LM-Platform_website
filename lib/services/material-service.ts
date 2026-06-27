import { randomUUID } from "crypto";

import { createSignedMaterialUrl } from "@/lib/integrations/supabase-storage-adapter";
import { createGlobalNotificationRepository } from "@/lib/repositories/global-notification-repository";
import {
  createMaterialRepository,
  findCourseForMaterialUploadRepository,
  getReadableMaterialRepository,
} from "@/lib/repositories/material-repository";
import { hasClassroomAccessRepository, listClassroomMaterialsRepository } from "@/lib/repositories/classroom-repository";
import { ensureTeacherPersonalLibraryCapacity } from "@/lib/services/personal-library-service";
import type { Material, MaterialUploadIntent, ReadableMaterial } from "@/lib/types/material";
import type { ServiceResult } from "@/lib/types/service-result";
import {
  createMaterialUploadIntentSchema,
  getReadableMaterialSchema,
  registerUploadedMaterialSchema,
} from "@/lib/validators/material-validator";

const MATERIAL_STORAGE_BUCKET = "course-materials";

export type CreateMaterialUploadIntentInput = {
  courseId?: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  fileName: string;
  fileType: string;
  fileSize: number;
};

export type RegisterUploadedMaterialInput = {
  courseId?: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  categoryId?: string;
  title: string;
  description?: string;
  sectionLabel?: string;
  tags?: string[];
  storageBucket: "course-materials";
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  allowDownload: boolean;
  reviewStatus?: "pending_review" | "approved" | "rejected";
};

export type GetReadableMaterialInput = {
  materialId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  classId?: string;
};

function normalizeRepositoryError(error: unknown): { message: string } {
  if (error instanceof Error) {
    return { message: error.message };
  }

  if (error && typeof error === "object") {
    const errorLike = error as { message?: unknown };
    if (typeof errorLike.message === "string") {
      return { message: errorLike.message };
    }
  }

  return { message: "Unknown repository error" };
}

function sanitizeFileName(fileName: string): string {
  const trimmedFileName = fileName.trim();
  const nameSegments = trimmedFileName.split(".");

  if (nameSegments.length <= 1) {
    return trimmedFileName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  }

  const extension = nameSegments.pop() ?? "";
  const baseName = nameSegments.join(".");
  const sanitizedBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const sanitizedExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);

  if (!sanitizedExtension) {
    return sanitizedBaseName || "material";
  }

  return `${sanitizedBaseName || "material"}.${sanitizedExtension}`;
}

/**
 * Creates a private upload intent after authorization and file validation.
 * The resulting path hides storage layout details from UI callsites.
 */
export async function createUploadIntent(
  input: CreateMaterialUploadIntentInput,
): Promise<ServiceResult<MaterialUploadIntent>> {
  const parsedInput = createMaterialUploadIntentSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu tải lên tài liệu không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (normalizedInput.actorRole !== "teacher" && normalizedInput.actorRole !== "admin" && normalizedInput.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền tải lên tài liệu cho học phần này.",
      },
    };
  }

  try {
    if (!normalizedInput.courseId && normalizedInput.actorRole === "teacher") {
      const quotaResult = await ensureTeacherPersonalLibraryCapacity({
        teacherId: normalizedInput.actorId,
        incomingBytes: normalizedInput.fileSize,
      });

      if (!quotaResult.ok) {
        return {
          ok: false,
          error: quotaResult.error,
        };
      }
    }

    const courseRecord = normalizedInput.courseId
      ? await findCourseForMaterialUploadRepository({
          courseId: normalizedInput.courseId,
          actorId: normalizedInput.actorId,
          actorRole: normalizedInput.actorRole,
        })
      : null;

    if (normalizedInput.courseId && !courseRecord) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần hoặc bạn không được phép tải lên tài liệu.",
        },
      };
    }

    if (courseRecord?.status === "archived") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Học phần đã lưu trữ, không thể tải thêm tài liệu.",
          field: "courseId",
        },
      };
    }

    const sanitizedFileName = sanitizeFileName(normalizedInput.fileName);
    const uploadIntentId = randomUUID();

    const uploadIntent: MaterialUploadIntent = {
      courseId: normalizedInput.courseId ?? null,
      storageBucket: MATERIAL_STORAGE_BUCKET,
      storagePath: `${normalizedInput.courseId ?? `personal/${normalizedInput.actorId}`}/${uploadIntentId}/${sanitizedFileName}`,
      fileName: sanitizedFileName,
      fileType: normalizedInput.fileType,
      fileSize: normalizedInput.fileSize,
    };

    return {
      ok: true,
      data: uploadIntent,
    };
  } catch (error) {
    const { message } = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo upload intent cho tài liệu.",
        details: message,
      },
    };
  }
}

/**
 * Registers material metadata only after an authorized file upload path has been issued.
 */
export async function registerUploadedMaterial(
  input: RegisterUploadedMaterialInput,
): Promise<ServiceResult<Material>> {
  const parsedInput = registerUploadedMaterialSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu đăng ký tài liệu không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (normalizedInput.actorRole !== "teacher" && normalizedInput.actorRole !== "admin" && normalizedInput.actorRole !== "moderator") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền lưu metadata tài liệu cho học phần này.",
      },
    };
  }

  const expectedStoragePrefix = normalizedInput.courseId ?? `personal/${normalizedInput.actorId}`;

  if (!normalizedInput.storagePath.startsWith(`${expectedStoragePrefix}/`)) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Đường dẫn lưu trữ tài liệu không hợp lệ.",
        field: "storagePath",
      },
    };
  }

  try {
    const courseRecord = normalizedInput.courseId
      ? await findCourseForMaterialUploadRepository({
          courseId: normalizedInput.courseId,
          actorId: normalizedInput.actorId,
          actorRole: normalizedInput.actorRole,
        })
      : null;

    if (normalizedInput.courseId && !courseRecord) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần hoặc bạn không được phép lưu tài liệu.",
        },
      };
    }

    if (courseRecord?.status === "archived") {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Học phần đã lưu trữ, không thể thêm tài liệu mới.",
          field: "courseId",
        },
      };
    }

    const material = await createMaterialRepository({
      courseId: normalizedInput.courseId,
      actorId: normalizedInput.actorId,
      categoryId: normalizedInput.categoryId,
      title: normalizedInput.title,
      description: normalizedInput.description,
      sectionLabel: normalizedInput.sectionLabel,
      tags: normalizedInput.tags,
      storageBucket: normalizedInput.storageBucket,
      storagePath: normalizedInput.storagePath,
      fileName: normalizedInput.fileName,
      fileType: normalizedInput.fileType,
      fileSize: normalizedInput.fileSize,
      allowDownload: normalizedInput.allowDownload,
      reviewStatus:
        normalizedInput.courseId && normalizedInput.actorRole === "teacher" ? "pending_review" : "approved",
    });

    if (material.courseId && normalizedInput.actorRole === "teacher" && material.reviewStatus === "pending_review") {
      const courseLabel = courseRecord ? `${courseRecord.code} - ${courseRecord.title}` : "học phần được chọn";

      await createGlobalNotificationRepository({
        title: "Có tài liệu chờ duyệt",
        content: `Giảng viên vừa tải lên tài liệu "${material.title}" cho ${courseLabel}. Hãy vào Thư viện để duyệt hoặc từ chối.`,
        createdBy: normalizedInput.actorId,
        createdByRole: normalizedInput.actorRole as "admin" | "moderator" | "teacher",
        audienceRoles: ["admin", "moderator"],
        kind: "material_upload_request",
        relatedEntityType: "material",
        relatedEntityId: material.id,
      });
    }

    return {
      ok: true,
      data: material,
    };
  } catch (error) {
    const { message } = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lưu metadata tài liệu.",
        details: message,
      },
    };
  }
}

/**
 * Returns signed URLs for authorized readers while hiding storage paths from UI.
 */
export async function getReadableMaterial(
  input: GetReadableMaterialInput,
): Promise<ServiceResult<ReadableMaterial>> {
  const parsedInput = getReadableMaterialSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu đọc tài liệu không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    let materialRecord = await getReadableMaterialRepository(parsedInput.data);

    if (!materialRecord && parsedInput.data.classId) {
      const hasClassAccess = await hasClassroomAccessRepository(parsedInput.data.classId);

      if (!hasClassAccess) {
        return {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy tài liệu hoặc bạn không được phép xem.",
          },
        };
      }

      const classMaterials = await listClassroomMaterialsRepository(parsedInput.data.classId);
      const hasLinkedMaterial = classMaterials.some((material) => material.id === parsedInput.data.materialId);

      if (!hasLinkedMaterial) {
        return {
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy tài liệu hoặc bạn không được phép xem.",
          },
        };
      }

      materialRecord = await getReadableMaterialRepository({
        ...parsedInput.data,
        useServiceRole: true,
      });
    }

    if (!materialRecord) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy tài liệu hoặc bạn không được phép xem.",
        },
      };
    }

    if (
      parsedInput.data.actorRole === "student" &&
      (materialRecord.status !== "published" || materialRecord.reviewStatus !== "approved")
    ) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy tài liệu hoặc bạn không được phép xem.",
        },
      };
    }

    if (!materialRecord.storageBucket || !materialRecord.storagePath) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Tài liệu này không còn tệp đính kèm hợp lệ để mở.",
        },
      };
    }

    const viewUrlResult = await createSignedMaterialUrl({
      bucket: materialRecord.storageBucket,
      path: materialRecord.storagePath,
      useServiceRole: true,
    });

    if (!viewUrlResult.ok) {
      return viewUrlResult;
    }

    let downloadUrl: string | undefined;

    if (materialRecord.allowDownload) {
      const downloadUrlResult = await createSignedMaterialUrl({
        bucket: materialRecord.storageBucket,
        path: materialRecord.storagePath,
        useServiceRole: true,
      });

      if (!downloadUrlResult.ok) {
        return downloadUrlResult;
      }

      downloadUrl = downloadUrlResult.data;
    }

    return {
      ok: true,
      data: {
        id: materialRecord.id,
        title: materialRecord.title,
        fileType: materialRecord.fileType,
        viewUrl: viewUrlResult.data,
        downloadUrl,
        allowDownload: materialRecord.allowDownload,
      },
    };
  } catch (error) {
    const { message } = normalizeRepositoryError(error);

    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải nội dung tài liệu.",
        details: message,
      },
    };
  }
}
