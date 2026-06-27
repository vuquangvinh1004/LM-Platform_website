import {
  approveStudentAccessRepository,
  checkScopedPermissionRepository,
  renewStudentAccessRepository,
} from "@/lib/repositories/access-control-repository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

export async function grantScopedPermission(input: {
  actorId: string;
  actorRole: "admin";
  targetActorId: string;
  scopeType: string;
  scopeId?: string;
  permissions: {
    manage_course: boolean;
    manage_class: boolean;
    manage_members: boolean;
  };
}): Promise<ServiceResult<{ granted: true }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được cấp scope.",
      },
    };
  }

  if (!input.targetActorId.trim() || !input.scopeType.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Thiếu dữ liệu cấp phạm vi quyền.",
      },
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("permission_scopes").insert({
      actor_id: input.targetActorId.trim(),
      scope_type: input.scopeType.trim(),
      scope_id: input.scopeType.trim() === "system" ? null : input.scopeId?.trim() || null,
      permissions: input.permissions,
      status: "active",
      granted_by: input.actorId,
    });

    if (error) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: "Không thể cấp scope.",
          details: error.message,
        },
      };
    }

    return {
      ok: true,
      data: { granted: true },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cấp scope.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function revokeScopedPermission(input: {
  actorId: string;
  actorRole: "admin";
  scopeId: string;
}): Promise<ServiceResult<{ revoked: true }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được thu hồi scope.",
      },
    };
  }

  if (!input.scopeId.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Thiếu mã scope cần thu hồi.",
      },
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("permission_scopes")
      .update({ status: "revoked" })
      .eq("id", input.scopeId.trim())
      .eq("status", "active");

    if (error) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN_ERROR",
          message: "Không thể thu hồi scope.",
          details: error.message,
        },
      };
    }

    return {
      ok: true,
      data: { revoked: true },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể thu hồi scope.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
