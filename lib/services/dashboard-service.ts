import { getTeacherDashboardRepository } from "@/lib/repositories/dashboard-repository";
import type { TeacherDashboard, TeacherDashboardFilterInput } from "@/lib/types/dashboard";
import type { ServiceResult } from "@/lib/types/service-result";
import { timed } from "@/lib/utils/timing";

/**
 * Returns a teacher-oriented dashboard summary with optional course/class filters.
 */
export async function getTeacherDashboard(input: TeacherDashboardFilterInput = {}): Promise<ServiceResult<TeacherDashboard>> {
  try {
    const data = await timed("dashboard.teacher", () => getTeacherDashboardRepository(input));

    return {
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải dashboard giảng viên.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
