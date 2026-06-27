import { listOpenEnrollmentOptionsRepository } from "@/lib/repositories/enrollment-option-repository";
import type { EnrollmentOption } from "@/lib/types/enrollment-option";
import type { ServiceResult } from "@/lib/types/service-result";

/**
 * Lists active classes/courses that students can request enrollment to.
 */
export async function listOpenEnrollmentOptions(): Promise<ServiceResult<{ options: EnrollmentOption[] }>> {
  try {
    const options = await listOpenEnrollmentOptionsRepository();

    return {
      ok: true,
      data: {
        options,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách học phần đang mở.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
