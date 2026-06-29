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

async function resolveLoginEmail(input: string): Promise<string> {
  const normalizedInput = input.trim();

  if (normalizedInput.toLowerCase() === ADMIN_LOGIN_ALIAS) {
    return LOCAL_LOGIN_ALIASES.admin;
  }

  const aliasMatch = LOCAL_LOGIN_ALIASES[normalizedInput.toLowerCase()];

  if (aliasMatch) {
    return aliasMatch;
  }

  if (normalizedInput.includes("@")) {
    return normalizedInput;
  }

  const serviceRoleClient = createServiceRoleSupabaseClient();
  const { data: matchedProfile } = await serviceRoleClient
    .from("profiles")
    .select("email")
    .or(`student_code.eq.${normalizedInput},role_code.eq.${normalizedInput}`)
    .maybeSingle<{ email: string | null }>();

  return matchedProfile?.email ?? normalizedInput;
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
  const loginEmail = await resolveLoginEmail(payload.data.email);

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
  _formData: FormData,
): Promise<AuthActionState> {
  return {
    status: "error",
    message: "Tự đăng ký hiện đang tạm khóa. Vui lòng liên hệ Admin để được tạo tài khoản.",
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
