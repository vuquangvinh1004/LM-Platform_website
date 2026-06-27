import {
  approveStudentAccessRepository,
  checkScopedPermissionRepository,
  renewStudentAccessRepository,
} from "@/lib/repositories/access-control-repository";
import type { ScopedPermissionCheckResult } from "@/lib/types/access-control";
import type { ServiceResult } from "@/lib/types/service-result";
import {
  approveStudentAccessSchema,
  renewStudentAccessSchema,
  scopedPermissionCheckSchema,
} from "@/lib/validators/access-control-validator";

/**
 * Checks whether actor has permission on a resource scope.
 */
export async function checkScopedPermission(
  input: Parameters<typeof scopedPermissionCheckSchema.parse>[0],
): Promise<ServiceResult<ScopedPermissionCheckResult>> {
  const parsedInput = scopedPermissionCheckSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu kiểm tra phạm vi quyền không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const allowed = await checkScopedPermissionRepository(parsedInput.data);

    return {
      ok: true,
      data: {
        allowed,
        reason: allowed ? undefined : "Người dùng không có phạm vi quyền phù hợp.",
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể kiểm tra phạm vi quyền.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Approves student access and optionally sets an expiry datetime.
 */
export async function approveStudentAccess(
  input: Parameters<typeof approveStudentAccessSchema.parse>[0],
): Promise<ServiceResult<{ studentId: string; accessStatus: "active" }>> {
  const parsedInput = approveStudentAccessSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu duyệt truy cập sinh viên không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    await approveStudentAccessRepository({
      studentId: parsedInput.data.studentId,
      actorId: parsedInput.data.actorId,
      expiresAt: parsedInput.data.expiresAt,
    });

    return {
      ok: true,
      data: {
        studentId: parsedInput.data.studentId,
        accessStatus: "active",
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể duyệt truy cập sinh viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Renews a student account expiry and keeps access in active state.
 */
export async function renewStudentAccess(
  input: Parameters<typeof renewStudentAccessSchema.parse>[0],
): Promise<ServiceResult<{ studentId: string; accessExpiresAt: string }>> {
  const parsedInput = renewStudentAccessSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gia hạn truy cập sinh viên không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    await renewStudentAccessRepository({
      studentId: parsedInput.data.studentId,
      actorId: parsedInput.data.actorId,
      expiresAt: parsedInput.data.expiresAt,
    });

    return {
      ok: true,
      data: {
        studentId: parsedInput.data.studentId,
        accessExpiresAt: parsedInput.data.expiresAt,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể gia hạn truy cập sinh viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
