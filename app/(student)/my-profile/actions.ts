"use server";

import { revalidatePath } from "next/cache";

import type { StudentProfileActionState } from "@/app/(student)/my-profile/profile-action-state";
import { requireRole } from "@/lib/services/auth-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function updateStudentProfileAction(
  _prevState: StudentProfileActionState,
  formData: FormData,
): Promise<StudentProfileActionState> {
  const profileResult = await requireRole(["student", "admin"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!email) {
    return {
      status: "error",
      message: "Email không được để trống.",
    };
  }

  const supabase = await createServerSupabaseClient();

  if (email !== profileResult.data.email.toLowerCase() || newPassword) {
    const { error: authError } = await supabase.auth.updateUser({
      email: email !== profileResult.data.email.toLowerCase() ? email : undefined,
      password: newPassword || undefined,
    });

    if (authError) {
      return {
        status: "error",
        message: "Không thể cập nhật email hoặc mật khẩu.",
      };
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email,
      avatar_url: avatarUrl || null,
    })
    .eq("id", profileResult.data.id);

  if (profileError) {
    return {
      status: "error",
      message: "Không thể cập nhật hồ sơ sinh viên.",
    };
  }

  revalidatePath("/my-profile");

  return {
    status: "success",
    message: "Đã cập nhật thông tin cá nhân.",
  };
}
