import { BackTextLink } from "@/components/ui/back-text-link";
import { requireRole } from "@/lib/services/auth-service";
import { getCourseAssessmentPublicationOverview } from "@/lib/services/course-assessment-publication-service";
import type { CourseAssessmentComponentType } from "@/lib/types/course";

const assessmentComponentTypeLabels: Record<CourseAssessmentComponentType, string> = {
  diagnostic: "Chẩn đoán",
  frequent: "Thường xuyên",
  periodic: "Định kỳ",
  final: "Tổng kết",
};

type CourseAssessmentResultsPageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CourseAssessmentResultsPage({ params }: CourseAssessmentResultsPageProps) {
  const profileResult = await requireRole(["moderator"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Kết quả đánh giá học phần</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
      </main>
    );
  }

  const resolvedParams = await params;
  const overviewResult = await getCourseAssessmentPublicationOverview({
    courseId: resolvedParams.courseId,
    actorRole: profileResult.data.role,
  });

  if (!overviewResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
        <BackTextLink href="/courses">Quay về Quản lý học phần</BackTextLink>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Kết quả đánh giá học phần</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {overviewResult.error.message}
        </div>
      </main>
    );
  }

  const overview = overviewResult.data;
  const componentGroups = overview.assessmentComponents.length > 0
    ? overview.assessmentComponents.map((component) => ({
        type: component.type,
        label: assessmentComponentTypeLabels[component.type] ?? component.type,
        subColumns: (component.cloCodes ?? []).length > 0 ? (component.cloCodes ?? []) : ["Điểm"],
      }))
    : [{ type: "final" as const, label: "Điểm", subColumns: ["Điểm"] }];

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <BackTextLink href="/courses">Quay về Quản lý học phần</BackTextLink>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">Kết quả đánh giá học phần</h1>
        <p className="mt-1 text-sm text-slate-600">
          {overview.courseCode} - {overview.courseTitle}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Bảng này chỉ nhận các kết quả mà giảng viên đã bấm <span className="font-semibold">NỘP KẾT QUẢ</span> từ trang kết quả bài kiểm tra.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="border border-slate-200 px-3 py-2 text-left font-medium" rowSpan={2}>Mã sinh viên</th>
              <th className="border border-slate-200 px-3 py-2 text-left font-medium" rowSpan={2}>Năm học</th>
              <th className="border border-slate-200 px-3 py-2 text-left font-medium" rowSpan={2}>Lớp</th>
              {componentGroups.map((group) => (
                <th
                  className="border border-slate-200 px-3 py-2 text-center font-semibold"
                  colSpan={group.subColumns.length}
                  key={group.type}
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr>
              {componentGroups.flatMap((group) =>
                group.subColumns.map((subColumn) => (
                  <th className="border border-slate-200 px-3 py-2 text-center font-medium" key={`${group.type}-${subColumn}`}>
                    {subColumn}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {overview.publishedRows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={3 + componentGroups.reduce((sum, group) => sum + group.subColumns.length, 0)}>
                  Chưa có kết quả nào được giảng viên nộp về học phần này.
                </td>
              </tr>
            ) : (
              overview.publishedRows.map((row) => (
                <tr className="odd:bg-white even:bg-slate-50/40" key={row.id}>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">{row.studentCode ?? row.studentIdentifier}</td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">{row.academicYear ?? "-"}</td>
                  <td className="border border-slate-200 px-3 py-2 text-slate-700">{row.classCode ?? row.classTitle ?? "-"}</td>
                  {componentGroups.flatMap((group) =>
                    group.subColumns.map((subColumn) => {
                      const isMatchingComponent = row.assessmentComponentType === group.type;

                      if (!isMatchingComponent) {
                        return (
                          <td className="border border-slate-200 px-3 py-2 text-center text-slate-300" key={`${row.id}-${group.type}-${subColumn}`}>
                            -
                          </td>
                        );
                      }

                      const cellValue = subColumn === "Điểm"
                        ? row.rawScore
                        : row.assessmentCloCodes.includes(subColumn)
                          ? row.cloScores[subColumn]
                          : undefined;

                      return (
                        <td className="border border-slate-200 px-3 py-2 text-center text-slate-700" key={`${row.id}-${group.type}-${subColumn}`}>
                          {cellValue ?? "-"}
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">Tổng số dòng đã nộp: {overview.publishedRows.length}</p>
    </main>
  );
}
