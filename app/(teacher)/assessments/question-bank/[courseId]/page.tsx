import { AssessmentManagementClient } from "@/app/(teacher)/assessments/assessment-management-client";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { listCoursesForUser } from "@/lib/services/course-service";
import { listQuestionBankItemsForCourses } from "@/lib/services/question-bank-service";
import type { QuestionBankItem } from "@/lib/types/question-bank";

type QuestionBankDetailPageProps = {
  params: Promise<{
    courseId: string;
  }>;
};

export default async function QuestionBankDetailPage({ params }: QuestionBankDetailPageProps) {
  const profileResult = await requireRole(["moderator"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Ngân hàng đề thi</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const { courseId } = await params;
  const coursesResult = await listCoursesForUser({
    userId: profileResult.data.id,
    role: profileResult.data.role,
    page: 1,
    pageSize: 100,
  });

  if (!coursesResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Ngân hàng đề thi</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {coursesResult.error.message}
        </div>
      </main>
    );
  }

  const questionBankCourses = coursesResult.data.items.map((course) => ({
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.title,
  }));
  const selectedCourse = questionBankCourses.find((course) => course.courseId === courseId);

  if (!selectedCourse) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <BackTextLink href="/assessments">Quay về Ngân hàng đề thi</BackTextLink>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Không tìm thấy học phần trong phạm vi GIÁM SÁT VIÊN đang quản lý.
        </div>
      </main>
    );
  }

  const questionBankResult = await listQuestionBankItemsForCourses({
    courseIds: questionBankCourses.map((course) => course.courseId),
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
        <BackTextLink href="/assessments">Quay về Ngân hàng đề thi</BackTextLink>
      </div>

      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">Ngân hàng đề thi {selectedCourse.courseTitle}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Quản lý câu hỏi của học phần {selectedCourse.courseCode} - {selectedCourse.courseTitle}, bao gồm CLO, Chương/Phần và trạng thái khả dụng cho giảng viên.
        </p>
      </div>

      <AssessmentManagementClient
        actorRole={profileResult.data.role}
        classes={[]}
        selectedQuestionBankCourseId={courseId}
        showModeratorQuestionBankCatalog={false}
        showModeratorQuestionBankCreate={false}
        showModeratorQuestionBankDetail
        courseMetadata={coursesResult.data.items.map((course) => ({
          courseId: course.id,
          courseCode: course.code,
          courseTitle: course.title,
          cloItems: course.cloItems,
          assessmentComponents: course.assessmentComponents,
        }))}
        assessments={[]}
        questionBankByCourse={questionBankCourses.map((course) => ({
          courseId: course.courseId,
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          items: questionBankItemsByCourseId.get(course.courseId) ?? [],
        }))}
      />
    </main>
  );
}
