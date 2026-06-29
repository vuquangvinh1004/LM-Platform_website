import { AssessmentManagementClient } from "@/app/(teacher)/assessments/assessment-management-client";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { listCoursesForUser } from "@/lib/services/course-service";
import { requireRole } from "@/lib/services/auth-service";
import { listAssessmentsForManager } from "@/lib/services/assessment-service";
import { listClassesForUser } from "@/lib/services/class-service";
import { listQuestionBankItemsForCourses } from "@/lib/services/question-bank-service";
import type { QuestionBankItem } from "@/lib/types/question-bank";

export default async function AssessmentsPage() {
  const profileResult = await requireRole(["teacher", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Bài kiểm tra</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const [classesResult, assessmentsResult, coursesResult] = await Promise.all([
    listClassesForUser({
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
      page: 1,
      pageSize: 100,
    }),
    listAssessmentsForManager({
      actorId: profileResult.data.id,
      actorRole: profileResult.data.role,
    }),
    listCoursesForUser({
      userId: profileResult.data.id,
      role: profileResult.data.role,
      page: 1,
      pageSize: 100,
    }),
  ]);

  if (!classesResult.ok || !assessmentsResult.ok || !coursesResult.ok) {
    const errorMessage = !classesResult.ok
      ? classesResult.error.message
      : !assessmentsResult.ok
        ? assessmentsResult.error.message
        : !coursesResult.ok
          ? coursesResult.error.message
        : "Không thể tải dữ liệu bài kiểm tra.";

    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý bài kiểm tra</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      </main>
    );
  }

  const uniqueCourses = Array.from(
    new Map(
      classesResult.data.items.map((courseClass) => [
        courseClass.courseId,
        {
          courseId: courseClass.courseId,
          courseCode: courseClass.courseCode,
          courseTitle: courseClass.courseTitle,
        },
      ]),
    ).values(),
  );

  const questionBankResult = await listQuestionBankItemsForCourses({
    courseIds: uniqueCourses.map((course) => course.courseId),
  });
  const questionBankItemsByCourseId = new Map<string, QuestionBankItem[]>();

  if (questionBankResult.ok) {
    for (const item of questionBankResult.data) {
      const existingItems = questionBankItemsByCourseId.get(item.courseId) ?? [];
      existingItems.push(item);
      questionBankItemsByCourseId.set(item.courseId, existingItems);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? (
          <div className="flex flex-wrap gap-4">
            <BackTextLink href="/classes">Quay về Quản lý lớp</BackTextLink>
            <BackTextLink href="/dashboard">Quay về Tổng quan giảng viên</BackTextLink>
          </div>
        ) : (
          <div />
        )}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý bài kiểm tra</h1>
        <p className="mt-1 text-sm text-slate-600">Tạo và quản lý liên kết bài kiểm tra Google Form hoặc Microsoft Form.</p>
      </div>

      <AssessmentManagementClient
        actorRole={profileResult.data.role}
        classes={classesResult.data.items}
        courseMetadata={coursesResult.data.items.map((course) => ({
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          cloItems: course.cloItems,
          assessmentComponents: course.assessmentComponents,
        }))}
        assessments={assessmentsResult.data.items}
        questionBankByCourse={uniqueCourses.map((course) => ({
          courseId: course.courseId,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          items: questionBankItemsByCourseId.get(course.courseId) ?? [],
        }))}
      />
    </main>
  );
}
