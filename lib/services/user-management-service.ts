import { readSpreadsheetMatrixFromCsv } from "@/lib/spreadsheets/spreadsheet-utils";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ProfileStatus, UserRole } from "@/lib/types/auth";
import type { ServiceResult } from "@/lib/types/service-result";
import type { ManagedStudentAccountSummary, ManagedUserSummary } from "@/lib/types/user-management";

type ManagedUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: ProfileStatus;
  role_code: string | null;
  student_code: string | null;
  created_at: string;
  personal_library_settings?: {
    storage_quota_bytes: number;
    storage_used_bytes: number;
  } | null;
  managed_student_accounts?: {
    current_password: string;
    created_at: string;
  } | null;
};

type StudentCsvRow = {
  studentCode: string;
  fullName: string;
  password: string;
};

function mapManagedUserRow(row: ManagedUserRow): ManagedUserSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    roleCode: row.role_code,
    studentCode: row.student_code,
    personalLibraryQuotaBytes: row.personal_library_settings?.storage_quota_bytes ?? null,
    personalLibraryUsedBytes: row.personal_library_settings?.storage_used_bytes ?? null,
    createdAt: row.created_at,
  };
}

function mapManagedStudentAccountRow(row: ManagedUserRow): ManagedStudentAccountSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    studentCode: row.student_code,
    status: row.status,
    createdAt: row.managed_student_accounts?.created_at ?? row.created_at,
    currentPassword: row.managed_student_accounts?.current_password ?? null,
  };
}

function buildManagedStudentEmail(studentCode: string): string {
  const normalizedCode = studentCode.trim().toLowerCase().replace(/[^a-z0-9]+/g, ".");
  return `student.${normalizedCode}@managed.local`;
}

function parseStudentCsv(content: string): StudentCsvRow[] {
  const matrix = readSpreadsheetMatrixFromCsv(content, "Tệp CSV không hợp lệ hoặc không có dữ liệu.");
  const rows = matrix.map((row) => row.map((cell) => String(cell ?? "").trim()));
  const header = rows[0] ?? [];

  const expectedHeader = ["Mã sinh viên", "Họ và tên", "Mật khẩu khởi tạo"];
  const normalizedHeader = header.map((value) => value.trim().toLowerCase());

  if (
    normalizedHeader.length !== expectedHeader.length ||
    normalizedHeader[0] !== expectedHeader[0].toLowerCase() ||
    normalizedHeader[1] !== expectedHeader[1].toLowerCase() ||
    normalizedHeader[2] !== expectedHeader[2].toLowerCase()
  ) {
    throw new Error("File CSV phải có đúng 3 header theo thứ tự: Mã sinh viên, Họ và tên, Mật khẩu khởi tạo.");
  }

  const parsedRows = rows
    .slice(1)
    .map((row) => ({
      studentCode: row[0] ?? "",
      fullName: row[1] ?? "",
      password: row[2] ?? "",
    }))
    .filter((row) => row.studentCode || row.fullName || row.password);

  if (parsedRows.length === 0) {
    throw new Error("File CSV chưa có dòng dữ liệu sinh viên hợp lệ.");
  }

  return parsedRows;
}

async function createOrUpdateManagedStudentAccount(input: {
  actorId: string;
  studentCode: string;
  fullName: string;
  password: string;
}): Promise<{ userId: string }> {
  const supabase = createServiceRoleSupabaseClient();
  const trimmedStudentCode = input.studentCode.trim();
  const email = buildManagedStudentEmail(trimmedStudentCode);

  const existingUserResult = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (existingUserResult.error) {
    throw existingUserResult.error;
  }

  const existingUser = existingUserResult.data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  let userId = existingUser?.id;

  if (existingUser) {
    const updateUserResult = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: input.password,
      email_confirm: true,
      app_metadata: { role: "student" },
      user_metadata: {
        role: "student",
        full_name: input.fullName.trim(),
        student_code: trimmedStudentCode,
      },
    });

    if (updateUserResult.error) {
      throw updateUserResult.error;
    }
  } else {
    const createResult = await supabase.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      app_metadata: { role: "student" },
      user_metadata: {
        role: "student",
        full_name: input.fullName.trim(),
        student_code: trimmedStudentCode,
      },
    });

    if (createResult.error || !createResult.data.user?.id) {
      throw createResult.error ?? new Error("STUDENT_ACCOUNT_CREATE_FAILED");
    }

    userId = createResult.data.user.id;
  }

  if (!userId) {
    throw new Error("STUDENT_ACCOUNT_ID_MISSING");
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: input.fullName.trim(),
    role: "student",
    status: "active",
    access_status: "active",
    access_expires_at: null,
    student_code: trimmedStudentCode,
    role_code: null,
  }, { onConflict: "id" });

  if (profileError) {
    throw profileError;
  }

  const { error: managedStudentError } = await supabase.from("managed_student_accounts").upsert({
    student_id: userId,
    current_password: input.password,
    created_by: input.actorId,
    updated_by: input.actorId,
  }, { onConflict: "student_id" });

  if (managedStudentError) {
    throw managedStudentError;
  }

  return { userId };
}

export async function listManagedUsers(): Promise<ServiceResult<ManagedUserSummary[]>> {
  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,email,full_name,role,status,role_code,student_code,created_at,personal_library_settings!personal_library_settings_teacher_id_fkey(storage_quota_bytes,storage_used_bytes)",
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

export async function listManagedStudentAccounts(): Promise<ServiceResult<ManagedStudentAccountSummary[]>> {
  try {
    const supabase = createServiceRoleSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,email,full_name,role,status,student_code,created_at,managed_student_accounts!managed_student_accounts_student_id_fkey(current_password,created_at)",
      )
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .returns<ManagedUserRow[]>();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data: (data ?? []).map(mapManagedStudentAccountRow),
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách tài khoản sinh viên.",
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
  roleCode?: string;
}): Promise<ServiceResult<{ userId: string }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được tạo tài khoản Giám sát hoặc Giảng viên.",
      },
    };
  }

  const trimmedRoleCode = input.roleCode?.trim().toUpperCase() || "";
  const requiredPrefix = input.role === "moderator" ? "MOD" : "LEC";

  if (!trimmedRoleCode.startsWith(requiredPrefix) || trimmedRoleCode.length <= requiredPrefix.length) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Mã nhân sự phải bắt đầu bằng ${requiredPrefix} và có thêm phần ký tự phía sau.`,
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
        role_code: trimmedRoleCode,
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
      role_code: trimmedRoleCode,
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

export async function createManagedStudentAccount(input: {
  actorId: string;
  actorRole: UserRole;
  studentCode: string;
  fullName: string;
  password: string;
}): Promise<ServiceResult<{ userId: string }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được tạo tài khoản sinh viên.",
      },
    };
  }

  if (!input.studentCode.trim() || !input.fullName.trim() || input.password.trim().length < 5) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Mã sinh viên, họ tên và mật khẩu khởi tạo là bắt buộc; mật khẩu tối thiểu 5 ký tự.",
      },
    };
  }

  try {
    const result = await createOrUpdateManagedStudentAccount({
      actorId: input.actorId,
      studentCode: input.studentCode,
      fullName: input.fullName,
      password: input.password,
    });

    return {
      ok: true,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tạo tài khoản sinh viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function createManagedStudentAccountsBulk(input: {
  actorId: string;
  actorRole: UserRole;
  csvContent: string;
}): Promise<ServiceResult<{ createdCount: number; errorCount: number; errors: string[] }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được tạo tài khoản sinh viên hàng loạt.",
      },
    };
  }

  try {
    const rows = parseStudentCsv(input.csvContent);
    let createdCount = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await createOrUpdateManagedStudentAccount({
          actorId: input.actorId,
          studentCode: row.studentCode,
          fullName: row.fullName,
          password: row.password,
        });
        createdCount += 1;
      } catch (error) {
        errors.push(`${row.studentCode || "Không rõ MSSV"}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      ok: true,
      data: {
        createdCount,
        errorCount: errors.length,
        errors,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "Không thể import tài khoản sinh viên từ CSV.",
      },
    };
  }
}

export async function updateManagedUserRoleAndStatus(input: {
  actorRole: UserRole;
  userId: string;
  role: UserRole;
  status: ProfileStatus;
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

export async function updateManagedStudentProfile(input: {
  actorRole: UserRole;
  studentId: string;
  fullName: string;
}): Promise<ServiceResult<{ updated: true }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được cập nhật thông tin sinh viên.",
      },
    };
  }

  if (!input.fullName.trim()) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Họ tên sinh viên không được để trống.",
      },
    };
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const trimmedFullName = input.fullName.trim();
    const { data: profile, error: profileReadError } = await supabase
      .from("profiles")
      .select("student_code")
      .eq("id", input.studentId)
      .eq("role", "student")
      .maybeSingle<{ student_code: string | null }>();

    if (profileReadError) {
      throw profileReadError;
    }

    const metadataResult = await supabase.auth.admin.updateUserById(input.studentId, {
      user_metadata: {
        role: "student",
        full_name: trimmedFullName,
        student_code: profile?.student_code ?? null,
      },
    });

    if (metadataResult.error) {
      throw metadataResult.error;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: trimmedFullName })
      .eq("id", input.studentId)
      .eq("role", "student");

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
        message: "Không thể cập nhật họ tên sinh viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function resetManagedStudentPassword(input: {
  actorId: string;
  actorRole: UserRole;
  studentId: string;
  newPassword: string;
}): Promise<ServiceResult<{ updated: true }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được thay đổi mật khẩu sinh viên.",
      },
    };
  }

  if (input.newPassword.trim().length < 5) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Mật khẩu mới tối thiểu 5 ký tự.",
      },
    };
  }

  try {
    const supabase = createServiceRoleSupabaseClient();
    const resetResult = await supabase.auth.admin.updateUserById(input.studentId, {
      password: input.newPassword,
    });

    if (resetResult.error) {
      throw resetResult.error;
    }

    const { error: metadataError } = await supabase
      .from("managed_student_accounts")
      .upsert({
        student_id: input.studentId,
        current_password: input.newPassword,
        created_by: input.actorId,
        updated_by: input.actorId,
      }, { onConflict: "student_id" });

    if (metadataError) {
      throw metadataError;
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
        message: "Không thể thay đổi mật khẩu sinh viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function deleteManagedStudentAccount(input: {
  actorRole: UserRole;
  studentId: string;
}): Promise<ServiceResult<{ deleted: true }>> {
  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ Admin được xóa tài khoản sinh viên.",
      },
    };
  }

  try {
    const supabase = createServiceRoleSupabaseClient();

    const { error: publishedResultsError } = await supabase
      .from("course_assessment_results")
      .update({
        student_id: null,
        submission_id: null,
      })
      .eq("student_id", input.studentId)
      .not("published_at", "is", null);

    if (publishedResultsError) {
      throw publishedResultsError;
    }

    const { error: classMembersError } = await supabase
      .from("class_members")
      .delete()
      .eq("student_id", input.studentId);

    if (classMembersError) {
      throw classMembersError;
    }

    const { error: directMessagesSenderError } = await supabase
      .from("direct_messages")
      .delete()
      .eq("sender_id", input.studentId);

    if (directMessagesSenderError) {
      throw directMessagesSenderError;
    }

    const { error: directMessagesRecipientError } = await supabase
      .from("direct_messages")
      .delete()
      .eq("recipient_id", input.studentId);

    if (directMessagesRecipientError) {
      throw directMessagesRecipientError;
    }

    const { error: managedStudentError } = await supabase
      .from("managed_student_accounts")
      .delete()
      .eq("student_id", input.studentId);

    if (managedStudentError) {
      throw managedStudentError;
    }

    const deleteAuthResult = await supabase.auth.admin.deleteUser(input.studentId);

    if (deleteAuthResult.error) {
      throw deleteAuthResult.error;
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
        message: "Không thể xóa tài khoản sinh viên.",
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
