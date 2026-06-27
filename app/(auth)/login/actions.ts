"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import type { AuthActionState } from "@/app/(auth)/login/auth-action-state";
import { getDefaultPathForRole } from "@/lib/services/auth-guard";
import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";

const ADMIN_LOGIN_ALIAS = "admin";
const ADMIN_LOGIN_EMAIL = "admin@local.test";
const ADMIN_LOGIN_PASSWORD = process.env.LOCAL_ADMIN_DEFAULT_PASSWORD ?? "Admin";
const LOCAL_LOGIN_ALIASES: Record<string, string> = {
  admin: ADMIN_LOGIN_EMAIL,
  mod123: "mod123@local.test",
  lec123: "lec123@local.test",
  stu123: "stu123@local.test",
  stu321: "stu321@local.test",
};

const signInSchema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email hoặc tên đăng nhập."),
  password: z.string().min(5, "Mật khẩu tối thiểu 5 ký tự."),
});

const signUpSchema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(5, "Mật khẩu tối thiểu 5 ký tự."),
  fullName: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự."),
  role: z.literal("student"),
  studentCode: z.string().trim().max(50).optional(),
});

function resolveLoginEmail(input: string): string {
  const normalizedInput = input.trim();

  if (normalizedInput.toLowerCase() === ADMIN_LOGIN_ALIAS) {
    return LOCAL_LOGIN_ALIASES.admin;
  }

  return LOCAL_LOGIN_ALIASES[normalizedInput.toLowerCase()] ?? normalizedInput;
}

async function ensureLocalAdminAccount(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const serviceRoleClient = createServiceRoleSupabaseClient();

  const { data: createUserData, error: createUserError } = await serviceRoleClient.auth.admin.createUser({
    email: ADMIN_LOGIN_EMAIL,
    password: ADMIN_LOGIN_PASSWORD,
    email_confirm: true,
    app_metadata: {
      role: "admin",
    },
    user_metadata: {
      role: "admin",
      full_name: "Local Admin",
    },
  });

  if (createUserError && !createUserError.message.toLowerCase().includes("already")) {
    throw createUserError;
  }

  let adminUserId = createUserData.user?.id;

  if (!adminUserId) {
    const { data: usersData, error: usersError } = await serviceRoleClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });

    if (usersError) {
      throw usersError;
    }

    adminUserId = usersData.users.find((user) => user.email?.toLowerCase() === ADMIN_LOGIN_EMAIL)?.id;
  }

  if (!adminUserId) {
    throw new Error("LOCAL_ADMIN_USER_NOT_FOUND");
  }

  const { error: profileUpsertError } = await serviceRoleClient.from("profiles").upsert(
    {
      id: adminUserId,
      email: ADMIN_LOGIN_EMAIL,
      full_name: "Local Admin",
      role: "admin",
      status: "active",
      access_status: "active",
      access_expires_at: null,
    },
    { onConflict: "id" },
  );

  if (profileUpsertError) {
    throw profileUpsertError;
  }
}

/**
 * Server action for password sign-in against Supabase Auth.
 */
export async function signInWithPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const payload = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!payload.success) {
    return {
      status: "error",
      message: payload.error.issues[0]?.message ?? "Dữ liệu đăng nhập không hợp lệ.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const loginEmail = resolveLoginEmail(payload.data.email);

  let { data, error } = await supabase.auth.signInWithPassword({
    email: loginEmail,
    password: payload.data.password,
  });

  let localAdminBootstrapFailed = false;
  const isAdminAliasAttempt = loginEmail.toLowerCase() === ADMIN_LOGIN_EMAIL && payload.data.password === ADMIN_LOGIN_PASSWORD;

  if ((error || !data.user) && isAdminAliasAttempt) {
    try {
      await ensureLocalAdminAccount();

      const retryResult = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: payload.data.password,
      });

      data = retryResult.data;
      error = retryResult.error;
    } catch {
      localAdminBootstrapFailed = true;
    }
  }

  if (error || !data.user) {
    if (localAdminBootstrapFailed) {
      return {
        status: "error",
        message: "Không thể khởi tạo tài khoản Admin local. Vui lòng kiểm tra SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY và thử lại.",
      };
    }

    return {
      status: "error",
      message: "Đăng nhập thất bại. Vui lòng kiểm tra email hoặc mật khẩu.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  const profileRole = profile?.role;
  const metadataRole = typeof data.user.user_metadata?.role === "string" ? data.user.user_metadata.role : undefined;
  const metadataFullName = typeof data.user.user_metadata?.full_name === "string" ? data.user.user_metadata.full_name.trim() : "";
  const fallbackEmail = data.user.email ?? "";

  const isKnownProfileRole =
    profileRole === "admin" ||
    profileRole === "moderator" ||
    profileRole === "teacher" ||
    profileRole === "student";

  const isKnownMetadataRole =
    metadataRole === "admin" ||
    metadataRole === "moderator" ||
    metadataRole === "teacher" ||
    metadataRole === "student";

  if (!profileRole && isKnownMetadataRole && fallbackEmail) {
    const fallbackFullName = metadataFullName || fallbackEmail.split("@")[0] || "User";

    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        email: fallbackEmail,
        full_name: fallbackFullName,
        role: metadataRole,
        status: "active",
      },
      { onConflict: "id" },
    );
  }

  const resolvedRole = isKnownProfileRole ? profileRole : isKnownMetadataRole ? metadataRole : undefined;

  const redirectTo = resolvedRole ? getDefaultPathForRole(resolvedRole) : "/login";

  return {
    status: "success",
    message: "Đăng nhập thành công.",
    redirectTo,
  };
}

/**
 * Server action for creating a Supabase Auth user with role/full_name metadata.
 */
export async function signUpWithPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const payload = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    role: formData.get("role"),
    studentCode: formData.get("studentCode"),
  });

  if (!payload.success) {
    return {
      status: "error",
      message: payload.error.issues[0]?.message ?? "Dữ liệu đăng ký không hợp lệ.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!payload.data.studentCode) {
    return {
      status: "error",
      message: "Vui lòng nhập mã số sinh viên.",
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: payload.data.email,
    password: payload.data.password,
    options: {
      data: {
        full_name: payload.data.fullName,
        role: payload.data.role,
        student_code: payload.data.studentCode,
      },
    },
  });

  if (error) {
    return {
      status: "error",
      message: "Đăng ký thất bại. Email có thể đã tồn tại.",
    };
  }

  if (data.user?.id) {
    const serviceRoleClient = createServiceRoleSupabaseClient();
    const { error: profileError } = await serviceRoleClient.from("profiles").upsert(
      {
        id: data.user.id,
        email: payload.data.email,
        full_name: payload.data.fullName,
        role: "student",
        status: "active",
        access_status: "pending_approval",
        student_code: payload.data.studentCode,
      },
      { onConflict: "id" },
    );

    if (profileError) {
      return {
        status: "error",
        message: "Đăng ký Auth thành công nhưng không thể lưu mã số sinh viên. Vui lòng thử lại bằng MSSV khác.",
      };
    }
  }

  return {
    status: "success",
    message: "Đăng ký sinh viên thành công. Tài khoản sẽ chờ duyệt truy cập theo quy trình hiện hành.",
  };
}

/**
 * Server action for explicit sign-out.
 */
export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
