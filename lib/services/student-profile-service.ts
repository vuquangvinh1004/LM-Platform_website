import { getStudentProfileOverviewRepository } from "@/lib/repositories/student-profile-repository";
import type { StudentProfileOverview } from "@/lib/types/student-profile";
import type { ServiceResult } from "@/lib/types/service-result";
import { getStudentProfileOverviewSchema } from "@/lib/validators/student-profile-validator";

/**
 * Returns lightweight student profile overview for allowed actors.
 */
export async function getStudentProfileOverview(
  input: Parameters<typeof getStudentProfileOverviewSchema.parse>[0],
): Promise<ServiceResult<StudentProfileOverview>> {
  const parsedInput = getStudentProfileOverviewSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu profile sinh viên không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  const normalizedInput = parsedInput.data;

  if (
    normalizedInput.actorRole === "student" &&
    normalizedInput.actorId !== normalizedInput.studentId
  ) {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem profile sinh viên này.",
      },
    };
  }

  try {
    const profileOverview = await getStudentProfileOverviewRepository(normalizedInput.studentId);

    if (!profileOverview) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy profile sinh viên.",
        },
      };
    }

    return {
      ok: true,
      data: profileOverview,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể lấy profile sinh viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
