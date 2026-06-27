import { AssessmentTakingClient } from "@/app/(student)/my-classes/assessments/[assessmentId]/assessment-taking-client";
import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { getAssessmentForStudent } from "@/lib/services/assessment-service";
import { getAssessmentAttemptForStudent, getStudentAssessmentReview, loadInternalAssessmentRuntime } from "@/lib/services/assessment-runtime-service";

export default async function StudentAssessmentDetailPage(
  { params }: { params: Promise<{ assessmentId: string }> },
) {
  const profileResult = await requireRole(["student", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Chi tiết bài kiểm tra</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const { assessmentId } = await params;

  const assessmentResult = await getAssessmentForStudent({
    assessmentId,
    studentId: profileResult.data.id,
  });

  if (!assessmentResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Chi tiết bài kiểm tra</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{assessmentResult.error.message}</div>
        <BackTextLink className="mt-4" href="/my-classes/assessments">Quay lại danh sách bài kiểm tra</BackTextLink>
      </main>
    );
  }

  const assessment = assessmentResult.data;
  let internalDefinition = null;
  let attemptView = null;
  let reviewResult = null;

  const [attemptResult, runtimeResult, studentReviewResult] = await Promise.all([
    getAssessmentAttemptForStudent({
      assessmentId,
      studentId: profileResult.data.id,
    }),
    assessment.deliveryMode === "internal"
      ? loadInternalAssessmentRuntime({
          assessmentId,
          actorId: profileResult.data.id,
          actorRole: profileResult.data.role,
        })
      : Promise.resolve(null),
    assessment.deliveryMode === "internal"
      ? getStudentAssessmentReview({
          assessmentId,
          studentId: profileResult.data.id,
        })
      : Promise.resolve(null),
  ]);

  attemptView = attemptResult.ok ? attemptResult.data : null;

  if (assessment.deliveryMode === "internal") {
    const runtimeData = runtimeResult;
    const reviewData = studentReviewResult;

    internalDefinition = runtimeData && "ok" in runtimeData && runtimeData.ok ? runtimeData.data : null;
    reviewResult = reviewData && "ok" in reviewData && reviewData.ok ? reviewData.data : null;
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <BackTextLink className="mb-4" href="/my-classes/assessments">Quay lại danh sách bài kiểm tra</BackTextLink>
      <h1 className="text-2xl font-semibold text-slate-900">{assessment.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{assessment.classCode} - {assessment.classTitle}</p>

      {assessment.description ? (
        <p className="mt-3 text-sm text-slate-700">{assessment.description}</p>
      ) : null}

      <AssessmentTakingClient assessment={assessment} attemptView={attemptView} internalDefinition={internalDefinition} review={reviewResult} />
    </main>
  );
}
