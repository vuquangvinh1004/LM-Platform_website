"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/services/auth-service";
import { createEnrollmentRequests } from "@/lib/services/enrollment-service";
import type { StudentEnrollmentActionState } from "@/app/(student)/my-classes/student-enrollment-action-state";

export async function requestClassEnrollmentAction(
  _prevState: StudentEnrollmentActionState,
  formData: FormData,
): Promise<StudentEnrollmentActionState> {
  const profileResult = await requireRole(["student"]);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const courseId = String(formData.get("courseId") ?? "").trim();
  const classId = String(formData.get("classId") ?? "").trim();

  const result = await createEnrollmentRequests({
    studentId: profileResult.data.id,
    requests: [{ courseId, classId }],
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.error.message,
    };
  }

  revalidatePath("/my-classes");

  if (result.data.created > 0) {
    return {
      status: "success",
      message: "Đã gửi yêu cầu tham gia lớp. Giảng viên/Mod/Admin sẽ duyệt trước khi lớp xuất hiện trong danh sách của bạn.",
    };
  }

  return {
    status: "error",
    message: "Yêu cầu này đã tồn tại hoặc đã được xử lý trước đó.",
  };
}
