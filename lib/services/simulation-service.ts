import {
  findCourseForSimulationRepository,
  listSimulationsForCourseRepository,
} from "@/lib/repositories/simulation-repository";
import type { ServiceResult } from "@/lib/types/service-result";
import type { SimulationSummary } from "@/lib/types/simulation";
import { listSimulationsForCourseSchema } from "@/lib/validators/simulation-validator";

export type ListSimulationsForCourseInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

/**
 * Returns simulation registry items for a course visible to the actor.
 */
export async function listSimulationsForCourse(
  input: ListSimulationsForCourseInput,
): Promise<ServiceResult<SimulationSummary[]>> {
  const parsedInput = listSimulationsForCourseSchema.safeParse(input);

  if (!parsedInput.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu danh sách simulation không hợp lệ.",
        details: parsedInput.error.flatten(),
      },
    };
  }

  try {
    const course = await findCourseForSimulationRepository(parsedInput.data.courseId);

    if (!course) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const items = await listSimulationsForCourseRepository(parsedInput.data.courseId);

    return {
      ok: true,
      data: items,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách simulation của học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
