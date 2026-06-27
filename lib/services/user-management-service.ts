import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/auth";
import type { ServiceResult } from "@/lib/types/service-result";
import type { ManagedUserSummary } from "@/lib/types/user-management";

type ManagedUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: "active" | "inactive" | "archived";
  teacher_code: string | null;
  student_code: string | null;
  created_at: string;
  personal_library_settings?: {
    storage_quota_bytes: number;
    storage_used_bytes: number;
  } | null;
};

function mapManagedUserRow(row: ManagedUserRow): ManagedUserSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    teacherCode: row.teacher_code,
    studentCode: row.student_code,
    personalLibraryQuotaBytes: row.personal_library_settings?.storage_quota_bytes ?? null,
    personalLibraryUsedBytes: row.personal_library_settings?.storage_used_bytes ?? null,
    createdAt: row.created_at,
  };
}

export async function listManagedUsers(): Promise<ServiceResult<ManagedUserSummary[]>> {
  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,email,full_name,role,status,teacher_code,student_code,created_at,personal_library_settings!personal_library_settings_teacher_id_fkey(storage_quota_bytes,storage_used_bytes)",
      )
      .order("created_at", { ascending: false })
      .returns<ManagedUserRow[]>();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data: (data ?? []).map(mapManagedUserRow),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách tài khoản quản trị.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createManagedStaffAccount(input: {
  actorId: string;
  actorRole: UserRole;
  email: string;
  password: string;
  fullName: string;
  role: Extract<UserRole, "moderator" | "teacher">;
  teacherCode?: string;
}): Promise<ServiceResult<{ userId: string }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được tạo tài khoản Mod hoặc Giảng viên.",
      },
    };
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      email_confirm: true,
      app_metadata: {
        role: input.role,
      },
      user_metadata: {
        role: input.role,
        full_name: input.fullName.trim(),
      },
    });

    if (error || !data.user?.id) {
      throw error ?? new Error("USER_CREATE_FAILED");
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      email: input.email.trim().toLowerCase(),
      full_name: input.fullName.trim(),
      role: input.role,
      status: "active",
      access_status: "active",
      teacher_code: input.role === "teacher" ? input.teacherCode?.trim() || null : null,
    }, {
      onConflict: "id",
    });

    if (profileError) {
      throw profileError;
    }

    if (input.role === "teacher") {
      await supabase.rpc("ensure_personal_library_settings", {
        target_teacher_id: data.user.id,
        actor_id: input.actorId,
      });
    }

    return {
      ok: true,
      data: {
        userId: data.user.id,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo tài khoản nhân sự.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function updateManagedUserRoleAndStatus(input: {
  actorRole: UserRole;
  userId: string;
  role: UserRole;
  status: "active" | "inactive" | "archived";
}): Promise<ServiceResult<{ updated: true }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được cập nhật tài khoản.",
      },
    };
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        role: input.role,
        status: input.status,
      })
      .eq("id", input.userId);

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data: { updated: true },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật vai trò hoặc trạng thái tài khoản.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function updateTeacherPersonalLibraryQuota(input: {
  actorId: string;
  actorRole: UserRole;
  teacherId: string;
  quotaBytes: number;
}): Promise<ServiceResult<{ updated: true }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được điều chỉnh dung lượng thư viện cá nhân.",
      },
    };
  }

  if (!Number.isFinite(input.quotaBytes) || input.quotaBytes <= 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dung lượng thư viện cá nhân không hợp lệ.",
      },
    };
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    await supabase.rpc("ensure_personal_library_settings", {
      target_teacher_id: input.teacherId,
      actor_id: input.actorId,
    });

    const { error } = await supabase
      .from("personal_library_settings")
      .update({
        storage_quota_bytes: input.quotaBytes,
        updated_by: input.actorId,
      })
      .eq("teacher_id", input.teacherId);

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data: { updated: true },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật dung lượng thư viện cá nhân.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
