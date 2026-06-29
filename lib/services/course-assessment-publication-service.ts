import { getCourseAssessmentPublicationOverviewRepository, publishAssessmentResultsToCourseRepository } from "@/lib/repositories/course-assessment-publication-repository";
import { getCourseByIdRepository } from "@/lib/repositories/course-repository";
import { findManageableAssessmentRepository } from "@/lib/repositories/submission-repository";
import type { CourseAssessmentPublicationOverview } from "@/lib/types/course-assessment-publication";
import type { ServiceResult } from "@/lib/types/service-result";

export async function publishAssessmentResultsToCourse(input: {
  assessmentId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
}): Promise<ServiceResult<{ courseId: string; publishedRows: number }>> {
  if (input.actorRole !== "teacher" && input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền nộp kết quả bài kiểm tra lên học phần.",
      },
    };
  }

  try {
    const manageableAssessment = await findManageableAssessmentRepository({
      assessmentId: input.assessmentId,
    });

    if (!manageableAssessment) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy bài kiểm tra hoặc bạn không có quyền nộp kết quả.",
        },
      };
    }

    if (!manageableAssessment.resultsLockedAt) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Bạn phải KHÓA KẾT QUẢ rồi mới được NỘP KẾT QUẢ.",
        },
      };
    }

    if (manageableAssessment.resultsPublishedAt) {
      return {
        ok: false,
        error: {
          code: "CONFLICT",
          message: "Kết quả bài kiểm tra này đã được nộp cho Mod và không thể hoàn tác.",
        },
      };
    }

    const published = await publishAssessmentResultsToCourseRepository({
      assessmentId: input.assessmentId,
      publishedBy: input.actorId,
    });

    return {
      ok: true,
      data: published,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể nộp kết quả bài kiểm tra lên học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function getCourseAssessmentPublicationOverview(input: {
  courseId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
}): Promise<ServiceResult<CourseAssessmentPublicationOverview>> {
  if (input.actorRole !== "moderator" && input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Bạn không có quyền xem kết quả đánh giá học phần.",
      },
    };
  }

  try {
    const course = await getCourseByIdRepository(input.courseId);

    if (!course) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy học phần hoặc bạn không có quyền truy cập.",
        },
      };
    }

    const overview = await getCourseAssessmentPublicationOverviewRepository(input.courseId);

    if (!overview) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy dữ liệu kết quả đánh giá học phần.",
        },
      };
    }

    return {
      ok: true,
      data: overview,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải kết quả đánh giá học phần.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
