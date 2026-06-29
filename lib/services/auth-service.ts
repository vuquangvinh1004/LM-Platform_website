import type { Profile, UserRole } from "@/lib/types/auth";
import type { ServiceResult } from "@/lib/types/service-result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Returns the currently authenticated profile using user-scoped Supabase session.
 */
export async function getCurrentProfile(): Promise<ServiceResult<Profile>> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Bạn cần đăng nhập để tiếp tục.",
      },
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,status,access_status,access_expires_at,student_code,role_code,avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lấy hồ sơ người dùng hiện tại.",
        details: error.message,
      },
    };
  }

  if (!data) {
    return {
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Không tìm thấy hồ sơ người dùng.",
      },
    };
  }

  return {
    ok: true,
    data: data as Profile,
  };
}

/**
 * Ensures current user profile exists and belongs to one of allowed roles.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<ServiceResult<Profile>> {
  const profileResult = await getCurrentProfile();

  if (!profileResult.ok) {
    return profileResult;
  }

  if (!allowedRoles.includes(profileResult.data.role)) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền truy cập chức năng này.",
      },
    };
  }

  if (profileResult.data.status !== "active") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Tài khoản của bạn hiện không ở trạng thái hoạt động.",
      },
    };
  }

  if (profileResult.data.role === "student") {
    if (profileResult.data.access_status !== "active") {
      return {
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Tài khoản sinh viên đang chờ duyệt hoặc đã bị tạm dừng.",
        },
      };
    }

    if (profileResult.data.access_expires_at) {
      const expiresAt = new Date(profileResult.data.access_expires_at);
      if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()) {
        return {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Tài khoản sinh viên đã hết hạn truy cập. Vui lòng liên hệ giảng viên hoặc quản trị viên.",
          },
        };
      }
    }
  }

  return profileResult;
}
