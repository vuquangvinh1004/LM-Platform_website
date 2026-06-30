"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  createAssessmentAction,
  createQuestionBankItemAction,
  deleteQuestionBankItemAction,
  deleteAssessmentAction,
  updateAssessmentStatusAction,
  updateQuestionBankItemAvailabilityAction,
} from "@/app/(teacher)/assessments/actions";
import { initialAssessmentActionState, type AssessmentActionState } from "@/app/(teacher)/assessments/assessment-action-state";
import { DateTimePickerField } from "@/components/ui/datetime-picker-field";
import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/auth";
import type { AssessmentSummary } from "@/lib/types/assessment";
import type { CourseClassSummary } from "@/lib/types/class";
import type { CourseAssessmentComponent, CourseCloItem } from "@/lib/types/course";
import type { QuestionBankItem, QuestionDifficulty } from "@/lib/types/question-bank";

type AssessmentManagementClientProps = {
  actorRole: UserRole;
  classes: CourseClassSummary[];
  selectedQuestionBankCourseId?: string;
  showModeratorQuestionBankCatalog?: boolean;
  showModeratorQuestionBankCreate?: boolean;
  showModeratorQuestionBankDetail?: boolean;
  courseMetadata: Array<{
    courseId: string;
    courseCode: string;
    courseTitle: string;
    cloItems: CourseCloItem[];
    assessmentComponents: CourseAssessmentComponent[];
  }>;
  assessments: AssessmentSummary[];
  questionBankByCourse: Array<{
    courseId: string;
    courseCode: string;
    courseTitle: string;
    items: QuestionBankItem[];
  }>;
};

const assessmentStatusLabels: Record<string, string> = {
  draft: "Bản nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Đã lưu trữ",
};

const deliveryModeLabels: Record<string, string> = {
  external: "Biểu mẫu ngoài",
  internal: "Làm bài trong website",
};

const providerLabels: Record<string, string> = {
  google_form: "Google Form",
  microsoft_form: "Microsoft Form",
  manual: "Nhập thủ công",
  internal: "Đề nội bộ",
  other: "Nguồn ngoài khác",
};

const embedModeLabels: Record<string, string> = {
  iframe: "Nhúng trong trang",
  new_tab: "Mở tab mới",
  disabled: "Tắt truy cập",
};

const assessmentComponentTypeLabels: Record<string, string> = {
  diagnostic: "Chẩn đoán",
  frequent: "Thường xuyên",
  periodic: "Định kỳ",
  final: "Tổng kết",
};

const questionTypeLabels: Record<string, string> = {
  multiple_choice: "Nhiều lựa chọn",
  true_false: "Đúng/Sai",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};

const difficultyLabels: Record<string, string> = {
  remembering: "Nhớ (Remembering)",
  understanding: "Hiểu (Understanding)",
  applying: "Vận dụng (Applying)",
  analyzing: "Phân tích (Analyzing)",
  evaluating: "Đánh giá (Evaluating)",
  creating: "Sáng tạo (Creating)",
};

const difficultyDefaultPoints: Record<QuestionDifficulty, number> = {
  remembering: 1,
  understanding: 2,
  applying: 4,
  analyzing: 6,
  evaluating: 8,
  creating: 10,
};

const allowedDifficultiesByQuestionBuilderType: Record<
  "multiple_choice_single" | "multiple_choice_multiple" | "true_false" | "short_answer" | "essay",
  QuestionDifficulty[]
> = {
  true_false: ["remembering", "understanding"],
  multiple_choice_single: ["remembering", "understanding", "applying"],
  multiple_choice_multiple: ["remembering", "understanding", "applying", "analyzing"],
  short_answer: ["applying", "analyzing", "evaluating"],
  essay: ["analyzing", "evaluating", "creating"],
};

const defaultChoiceRowIds = ["1", "2", "3", "4"];

type ChoiceRowState = {
  id: string;
  text: string;
  isCorrect: boolean;
};

const assessmentCardClasses: Record<string, string> = {
  draft: "border-slate-200 bg-slate-50/80",
  open: "border-emerald-200 bg-emerald-50/80",
  closed: "border-amber-200 bg-amber-50/80",
  archived: "border-violet-200 bg-violet-50/80",
};

function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString("vi-VN") : "-";
}

function formatTimeLimit(value?: number): string {
  return value ? `${value} phút` : "Không giới hạn";
}

function formatAttemptLimit(value: number): string {
  return `${value} lượt`;
}

function getQuestionTypeLabel(item: QuestionBankItem): string {
  if (item.questionType === "multiple_choice") {
    return Array.isArray(item.answerKey) ? "Nhiều đáp án" : "Nhiều lựa chọn";
  }

  return questionTypeLabels[item.questionType] ?? item.questionType;
}

function AssessmentStatusSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Đang lưu..." : "Lưu trạng thái"}
    </button>
  );
}

function AssessmentDeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Đang xóa..." : "Xóa bài kiểm tra"}
    </button>
  );
}

function QuestionBankDeleteSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? "Đang xóa..." : "Xóa"}
    </button>
  );
}

function formatQuestionBankMetadata(item: QuestionBankItem): string {
  const parts = [
    getQuestionTypeLabel(item),
    item.cloCode ? item.cloCode : null,
    item.chapterLabel ? `Chương ${item.chapterLabel}` : null,
    difficultyLabels[item.difficulty] ?? item.difficulty,
    `${item.defaultPoints} điểm`,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" | ");
}

type QuestionStatisticRow = {
  label: string;
  count: number;
  points: number;
  ratio: number;
};

function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDifficultyStatisticLabel(difficulty: QuestionDifficulty): string {
  return difficultyLabels[difficulty].split(" (")[0] ?? difficultyLabels[difficulty];
}

function buildQuestionStatisticRows(
  items: QuestionBankItem[],
  getLabel: (item: QuestionBankItem) => string,
): QuestionStatisticRow[] {
  const totalPoints = items.reduce((sum, item) => sum + item.defaultPoints, 0);
  const rowsByLabel = new Map<string, { count: number; points: number }>();

  for (const item of items) {
    const label = getLabel(item);
    const existing = rowsByLabel.get(label) ?? { count: 0, points: 0 };
    existing.count += 1;
    existing.points += item.defaultPoints;
    rowsByLabel.set(label, existing);
  }

  const rows = Array.from(rowsByLabel.entries()).map(([label, value]) => ({
    label,
    count: value.count,
    points: value.points,
    ratio: totalPoints > 0 ? (value.points / totalPoints) * 100 : 0,
  }));

  return rows.sort((left, right) => left.label.localeCompare(right.label, "vi"));
}

function QuestionStatisticsTable(props: {
  title: string;
  rows: QuestionStatisticRow[];
}) {
  const totalCount = props.rows.reduce((sum, row) => sum + row.count, 0);
  const totalPoints = props.rows.reduce((sum, row) => sum + row.points, 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-slate-900">{props.title}</h4>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-700">
              <th className="border border-slate-200 px-3 py-2 text-left">{props.title}</th>
              <th className="border border-slate-200 px-3 py-2 text-center">Số câu</th>
              <th className="border border-slate-200 px-3 py-2 text-center">Điểm</th>
              <th className="border border-slate-200 px-3 py-2 text-center">Tỷ lệ</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr key={row.label}>
                <td className="border border-slate-200 px-3 py-2">{row.label}</td>
                <td className="border border-slate-200 px-3 py-2 text-center">{row.count}</td>
                <td className="border border-slate-200 px-3 py-2 text-center">{row.points}</td>
                <td className="border border-slate-200 px-3 py-2 text-center">{formatPercentage(row.ratio)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-semibold text-slate-900">
              <td className="border border-slate-200 px-3 py-2">Tổng</td>
              <td className="border border-slate-200 px-3 py-2 text-center">{totalCount}</td>
              <td className="border border-slate-200 px-3 py-2 text-center">{totalPoints}</td>
              <td className="border border-slate-200 px-3 py-2 text-center">{formatPercentage(totalPoints > 0 ? 100 : 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AssessmentManagementClient({
  actorRole,
  classes,
  selectedQuestionBankCourseId = "",
  showModeratorQuestionBankCatalog = true,
  showModeratorQuestionBankCreate = true,
  showModeratorQuestionBankDetail = false,
  courseMetadata,
  assessments,
  questionBankByCourse,
}: AssessmentManagementClientProps) {
  const isTeacher = actorRole === "teacher";
  const isModerator = actorRole === "moderator";
  const [selectedClassPair, setSelectedClassPair] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"external" | "internal">("external");
  const [creationStatus, setCreationStatus] = useState<AssessmentSummary["status"]>("draft");
  const [attemptLimitDraftValue, setAttemptLimitDraftValue] = useState("2");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [questionBuilderType, setQuestionBuilderType] = useState<"multiple_choice_single" | "multiple_choice_multiple" | "true_false" | "short_answer" | "essay">("multiple_choice_single");
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficulty>("remembering");
  const [defaultPointsValue, setDefaultPointsValue] = useState(String(difficultyDefaultPoints.remembering));
  const [pendingStatusOverrides, setPendingStatusOverrides] = useState<Record<string, AssessmentSummary["status"]>>({});
  const [questionPromptValue, setQuestionPromptValue] = useState("");
  const [choiceRows, setChoiceRows] = useState<ChoiceRowState[]>(defaultChoiceRowIds.map((id) => ({ id, text: "", isCorrect: false })));
  const [trueFalseAnswerKey, setTrueFalseAnswerKey] = useState("Đúng");
  const [shortAnswerKeyValue, setShortAnswerKeyValue] = useState("");
  const [explanationValue, setExplanationValue] = useState("");
  const [selectedQuestionBankCourseForForm, setSelectedQuestionBankCourseForForm] = useState(selectedQuestionBankCourseId);
  const [selectedQuestionBankCloCode, setSelectedQuestionBankCloCode] = useState("");
  const [chapterLabelValue, setChapterLabelValue] = useState("");
  const resetQuestionBankForm = () => {
    setQuestionPromptValue("");
    setChoiceRows(defaultChoiceRowIds.map((id) => ({ id, text: "", isCorrect: false })));
    setTrueFalseAnswerKey("Đúng");
    setShortAnswerKeyValue("");
    setExplanationValue("");
    setSelectedQuestionBankCloCode("");
    setChapterLabelValue("");
    setQuestionBuilderType("multiple_choice_single");
    setQuestionDifficulty("remembering");
    setDefaultPointsValue(String(difficultyDefaultPoints.remembering));
  };
  const createQuestionBankActionWithClientState = async (
    prevState: AssessmentActionState,
    formData: FormData,
  ) => {
    const result = await createQuestionBankItemAction(prevState, formData);

    if (result.status === "success") {
      resetQuestionBankForm();
    }

    return {
      ...result,
      nonce: Date.now(),
    };
  };
  const [createState, createAction, isPending] = useActionState(createAssessmentAction, initialAssessmentActionState);
  const [questionBankState, questionBankAction, isQuestionBankPending] = useActionState(
    createQuestionBankActionWithClientState,
    initialAssessmentActionState,
  );
  const [deleteQuestionBankState, deleteQuestionBankAction] = useActionState(
    deleteQuestionBankItemAction,
    initialAssessmentActionState,
  );
  const [statusUpdateState, statusUpdateAction] = useActionState(
    updateAssessmentStatusAction,
    initialAssessmentActionState,
  );
  const [deleteState, deleteAction] = useActionState(
    deleteAssessmentAction,
    initialAssessmentActionState,
  );
  useRefreshOnSuccess({ status: questionBankState.status, nonce: questionBankState.nonce });
  useRefreshOnSuccess({ status: deleteQuestionBankState.status });
  useRefreshOnSuccess({ status: statusUpdateState.status });
  useRefreshOnSuccess({ status: deleteState.status });

  const selectedCourseId = selectedClassPair.split("::")[1] ?? "";
  const selectedCourseMetadata = courseMetadata.find((course) => course.courseId === selectedCourseId);
  const selectedAssessmentComponents = selectedCourseMetadata?.assessmentComponents ?? [];
  const selectedQuestionBankItems = questionBankByCourse.find((bundle) => bundle.courseId === selectedCourseId)?.items ?? [];
  const [selectedAssessmentComponentType, setSelectedAssessmentComponentType] = useState("");
  const effectiveSelectedAssessmentComponentType = selectedAssessmentComponents.some(
    (component) => component.type === selectedAssessmentComponentType,
  )
    ? selectedAssessmentComponentType
    : (selectedAssessmentComponents[0]?.type ?? "");
  const selectedAssessmentComponent = selectedAssessmentComponents.find(
    (component) => component.type === effectiveSelectedAssessmentComponentType,
  );
  const selectedAssessmentCloCodes = selectedAssessmentComponent?.cloCodes ?? [];
  const availableQuestionBankItems = selectedQuestionBankItems.filter((item) => item.isAvailable);
  const visibleQuestionBankItems = availableQuestionBankItems.filter((item) =>
    selectedAssessmentCloCodes.length === 0 ? true : Boolean(item.cloCode && selectedAssessmentCloCodes.includes(item.cloCode)),
  );
  const selectedTeacherQuestionItems = visibleQuestionBankItems.filter((item) => selectedQuestionIds.includes(item.id));
  const cloStatisticRows = buildQuestionStatisticRows(
    selectedTeacherQuestionItems,
    (item) => item.cloCode ?? "Chưa gắn CLO",
  );
  const chapterStatisticRows = buildQuestionStatisticRows(
    selectedTeacherQuestionItems,
    (item) => item.chapterLabel ?? "Chưa gắn chương",
  );
  const difficultyStatisticRows = buildQuestionStatisticRows(
    selectedTeacherQuestionItems,
    (item) => formatDifficultyStatisticLabel(item.difficulty),
  );
  const availableQuestionDifficulties = allowedDifficultiesByQuestionBuilderType[questionBuilderType];
  const selectedModeratorCourseMetadata = courseMetadata.find((course) => course.courseId === selectedQuestionBankCourseForForm);
  const selectedQuestionBankCourseBundle = questionBankByCourse.find((course) => course.courseId === selectedQuestionBankCourseId);

  return (
    <div className="space-y-8">
      {!isModerator ? (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Danh sách bài kiểm tra</h2>
          <div className="mt-4 space-y-3">
            {assessments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600">Chưa có bài kiểm tra nào.</div>
            ) : (
              assessments.map((assessment) => (
                (() => {
                  const currentStatus = pendingStatusOverrides[assessment.id] ?? assessment.status;

                  return (
                    <article
                      className={cn(
                        "rounded-lg border p-4 transition-colors",
                        assessmentCardClasses[currentStatus] ?? "border-slate-200 bg-white",
                      )}
                      key={assessment.id}
                    >
                      <h3 className="text-base font-semibold text-slate-900">{assessment.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {assessment.classCode} - {assessment.classTitle} | {assessment.courseCode}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Hình thức: {deliveryModeLabels[assessment.deliveryMode] ?? assessment.deliveryMode} | Nguồn:{" "}
                        {providerLabels[assessment.provider] ?? assessment.provider} | Cách mở: {embedModeLabels[assessment.embedMode] ?? assessment.embedMode} | Trạng thái:{" "}
                        {assessmentStatusLabels[currentStatus] ?? currentStatus}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Thành phần: {assessment.assessmentComponentType ? assessmentComponentTypeLabels[assessment.assessmentComponentType] ?? assessment.assessmentComponentType : "-"}
                        {" | "}
                        CLO: {(assessment.assessmentCloCodes ?? []).length > 0 ? (assessment.assessmentCloCodes ?? []).join(", ") : "-"}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md bg-slate-50 px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bắt đầu</span>
                          <p className="mt-1">{formatDateTime(assessment.openAt)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thời hạn làm bài</span>
                          <p className="mt-1">{assessment.status === "draft" ? "Không áp dụng cho bản nháp" : formatDateTime(assessment.dueAt)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Thời lượng</span>
                          <p className="mt-1">{assessment.status === "draft" ? "Không giới hạn thời gian" : formatTimeLimit(assessment.timeLimitMinutes)}</p>
                        </div>
                        <div className="rounded-md bg-slate-50 px-3 py-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Số lượt làm bài</span>
                          <p className="mt-1">{formatAttemptLimit(assessment.attemptLimit)}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <Link
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                            href={`/assessments/${assessment.id}/results`}
                          >
                            Xem kết quả
                          </Link>
                          <form action={statusUpdateAction} className="flex flex-wrap items-center gap-2">
                            <input name="assessmentId" type="hidden" value={assessment.id} />
                            <select
                              className="rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700"
                              name="status"
                              disabled={assessment.status === "draft"}
                              onChange={(event) =>
                                setPendingStatusOverrides((current) => ({
                                  ...current,
                                  [assessment.id]: event.target.value as AssessmentSummary["status"],
                                }))}
                              value={currentStatus}
                            >
                              {assessment.status === "draft" ? (
                                <option value="draft">Bản nháp</option>
                              ) : (
                                <>
                                  <option value="open">Đang mở</option>
                                  <option value="closed">Đã đóng</option>
                                  <option value="archived">Đã lưu trữ</option>
                                </>
                              )}
                            </select>
                            <AssessmentStatusSubmitButton />
                          </form>
                        </div>
                        <form
                          action={deleteAction}
                          onSubmit={(event) => {
                            const confirmed = window.confirm(
                              "Thao tác này sẽ xóa bỏ hoàn toàn bài kiểm tra khỏi hệ thống và không thể phục hồi. Bạn có chắc chắn muốn tiếp tục không?",
                            );

                            if (!confirmed) {
                              event.preventDefault();
                            }
                          }}
                        >
                          <input name="assessmentId" type="hidden" value={assessment.id} />
                          <AssessmentDeleteSubmitButton />
                        </form>
                      </div>
                      {assessment.status === "draft" ? (
                        <p className="mt-2 text-xs text-slate-600">
                          Bài kiểm tra Bản nháp chỉ dùng để hỗ trợ học tập và không thể chuyển sang trạng thái chính thức.
                        </p>
                      ) : null}
                    </article>
                  );
                })()
              ))
            )}
          </div>
        </section>
      ) : null}

      {isTeacher ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-lg font-semibold text-slate-900">Tạo bài kiểm tra cho lớp học</h2>
          <form action={createAction} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="create-assessment-form">
          <label className="text-sm text-slate-700">
            Lớp học phần
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="classCoursePair"
              onChange={(event) => {
                setSelectedClassPair(event.target.value);
                setSelectedQuestionIds([]);
              }}
              required
              value={selectedClassPair}
            >
              <option value="">Chọn lớp</option>
              {classes.map((courseClass) => (
                <option key={courseClass.id} value={`${courseClass.id}::${courseClass.courseId}`}>
                  {courseClass.classCode} - {courseClass.title}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Tiêu đề
            <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="title" required />
          </label>

          <label className="text-sm text-slate-700">
            Hình thức bài kiểm tra
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="deliveryMode"
              onChange={(event) => {
                const nextMode = event.target.value as "external" | "internal";
                setDeliveryMode(nextMode);
                if (nextMode === "external") {
                  setSelectedQuestionIds([]);
                }
              }}
              value={deliveryMode}
            >
              <option value="external">Biểu mẫu ngoài</option>
              <option value="internal">Làm bài trực tiếp trong website</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Thành phần
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="assessmentComponentType"
              onChange={(event) => {
                setSelectedAssessmentComponentType(event.target.value);
                setSelectedQuestionIds([]);
              }}
              required
              value={effectiveSelectedAssessmentComponentType}
            >
              <option value="">Chọn thành phần đánh giá</option>
              {selectedAssessmentComponents.map((component) => (
                <option key={component.type} value={component.type}>
                  {assessmentComponentTypeLabels[component.type]} ({component.weight}%)
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Nguồn biểu mẫu
            {deliveryMode === "internal" ? (
              <>
                <input name="provider" type="hidden" value="internal" />
                <div className="mt-1 rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  Đề nội bộ từ ngân hàng câu hỏi của website
                </div>
              </>
            ) : (
              <>
                <input name="provider" type="hidden" value="other" />
                <input
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  name="formUrl"
                  placeholder="Dán liên kết Google Form, Microsoft Form hoặc nguồn ngoài khác"
                  type="url"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Hệ thống sẽ tự nhận diện Google Form, Microsoft Form hoặc nguồn biểu mẫu ngoài phù hợp từ đường dẫn bạn nhập.
                </span>
              </>
            )}
          </label>

          <div className="rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
            <p className="font-medium text-slate-900">CLO áp dụng cho bài kiểm tra</p>
            {effectiveSelectedAssessmentComponentType ? (
              (() => {
                const selectedComponent = selectedAssessmentComponents.find((component) => component.type === effectiveSelectedAssessmentComponentType);
                const cloCodes = selectedComponent?.cloCodes ?? [];

                return cloCodes.length > 0 ? (
                  <>
                    <input name="assessmentCloCodes" type="hidden" value={JSON.stringify(cloCodes)} />
                    <p className="mt-2">{cloCodes.join(", ")}</p>
                  </>
                ) : (
                  <>
                    <input name="assessmentCloCodes" type="hidden" value="[]" />
                    <p className="mt-2 text-slate-500">Thành phần này hiện chưa gắn CLO nào ở học phần.</p>
                  </>
                );
              })()
            ) : (
              <>
                <input name="assessmentCloCodes" type="hidden" value="[]" />
                <p className="mt-2 text-slate-500">Chọn lớp và thành phần để hệ thống tự hiển thị các CLO tương ứng.</p>
              </>
            )}
          </div>

          {deliveryMode === "internal" ? (
            <input name="formUrl" type="hidden" value="" />
          ) : null}

          {deliveryMode === "external" ? (
            <label className="text-sm text-slate-700">
              Cách mở bài kiểm tra
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="embedMode" defaultValue="new_tab">
                <option value="iframe">Nhúng trong trang</option>
                <option value="new_tab">Mở tab mới</option>
                <option value="disabled">Tắt truy cập</option>
              </select>
            </label>
          ) : (
            <input name="embedMode" type="hidden" value="disabled" />
          )}

          <label className="text-sm text-slate-700">
            Trạng thái
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="status"
              onChange={(event) => setCreationStatus(event.target.value as AssessmentSummary["status"])}
              value={creationStatus}
            >
              <option value="draft">Bản nháp</option>
              <option value="open">Đang mở</option>
            </select>
          </label>

          <DateTimePickerField label="Mở từ lúc" name="openAt" />

          <DateTimePickerField label="Thời hạn làm bài" name="dueAt" />

          <label className="text-sm text-slate-700">
            Số lượt làm tối đa
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              min="1"
              name="attemptLimit"
              onChange={(event) => setAttemptLimitDraftValue(event.target.value)}
              readOnly={creationStatus === "open"}
              type="number"
              value={creationStatus === "open" ? "1" : attemptLimitDraftValue}
            />
            <span className="mt-1 block text-xs text-slate-500">
              {creationStatus === "open"
                ? "Bài kiểm tra Đang mở luôn bị khóa ở 1 lượt làm."
                : "Chỉ bài kiểm tra Bản nháp mới được thiết lập nhiều hơn 1 lượt làm."}
            </span>
          </label>

          <label className="text-sm text-slate-700">
            Giới hạn thời gian (phút)
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              disabled={creationStatus === "draft"}
              min="1"
              name="timeLimitMinutes"
              placeholder={creationStatus === "draft" ? "Bản nháp không áp dụng giới hạn thời gian" : "Để trống nếu không giới hạn"}
              type="number"
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="shuffleQuestions" type="checkbox" value="on" />
            <span>Trộn thứ tự câu hỏi khi làm bài nội bộ</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="showFeedbackAfterSubmit" type="checkbox" value="on" />
            <span>Hiển thị phản hồi sau khi nộp bài nội bộ</span>
          </label>

          {deliveryMode === "internal" ? (
            <>
              <div className="md:col-span-2 grid gap-4 lg:grid-cols-3">
                <QuestionStatisticsTable rows={cloStatisticRows} title="CLO" />
                <QuestionStatisticsTable rows={chapterStatisticRows} title="Chương" />
                <QuestionStatisticsTable rows={difficultyStatisticRows} title="Mức độ" />
              </div>

              <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Chọn câu hỏi từ ngân hàng đề của học phần</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Giảng viên chỉ chọn lại các câu hỏi đã có trong ngân hàng đề do GIÁM SÁT VIÊN quản lý. Hệ thống sẽ snapshot các câu hỏi được chọn vào bài kiểm tra nội bộ.
                </p>
                {!selectedCourseId ? (
                  <p className="mt-2 text-sm text-slate-500">Chọn lớp học trước để hiển thị ngân hàng đề tương ứng.</p>
                ) : availableQuestionBankItems.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Học phần này chưa có câu hỏi khả dụng nào trong ngân hàng đề.</p>
                ) : visibleQuestionBankItems.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Chưa có câu hỏi khả dụng nào khớp với CLO áp dụng cho bài kiểm tra
                    {selectedAssessmentCloCodes.length > 0 ? ` (${selectedAssessmentCloCodes.join(", ")}).` : "."}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {visibleQuestionBankItems.map((item) => (
                      <label className="flex items-start gap-2 text-sm text-slate-700" key={item.id}>
                        <input
                          checked={selectedQuestionIds.includes(item.id)}
                          name="questionId"
                          onChange={(event) => {
                            const nextChecked = event.target.checked;
                            setSelectedQuestionIds((current) =>
                              nextChecked ? [...current, item.id] : current.filter((questionId) => questionId !== item.id),
                            );
                          }}
                          type="checkbox"
                          value={item.id}
                        />
                        <span>
                          <span className="font-medium text-slate-900">{item.prompt}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            {formatQuestionBankMetadata(item)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : null}

          <div className="md:col-span-2">
            <button className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? "Đang tạo..." : "Tạo bài kiểm tra"}
            </button>
          </div>
        </form>

        {createState.message ? (
          <p className={createState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"} data-testid="create-assessment-message">
            {createState.message}
          </p>
        ) : null}
        </section>
      ) : null}

      {statusUpdateState.message ? (
        <p className={statusUpdateState.status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
          {statusUpdateState.message}
        </p>
      ) : null}

      {deleteState.message ? (
        <p className={deleteState.status === "error" ? "text-sm text-red-600" : "text-sm text-emerald-700"}>
          {deleteState.message}
        </p>
      ) : null}

      {isModerator ? (
        <>
          {showModeratorQuestionBankCatalog ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Danh sách ngân hàng đề thi</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                {questionBankByCourse.map((course) => (
                  <Link
                    className={course.courseId === selectedQuestionBankCourseId
                      ? "rounded-md border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900"
                      : "rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"}
                    href={`/assessments/question-bank/${course.courseId}`}
                    key={course.courseId}
                  >
                    {course.courseCode} - {course.courseTitle}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {showModeratorQuestionBankCreate ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Tạo câu hỏi</h2>
              <form action={questionBankAction} className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Học phần
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    name="courseId"
                    onChange={(event) => {
                      setSelectedQuestionBankCourseForForm(event.target.value);
                      setSelectedQuestionBankCloCode("");
                    }}
                    required
                    value={selectedQuestionBankCourseForForm}
                  >
                    <option value="">Chọn học phần</option>
                    {questionBankByCourse.map((course) => (
                      <option key={course.courseId} value={course.courseId}>
                        {course.courseCode} - {course.courseTitle}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-slate-700">
                  Loại câu hỏi
                  <span className="ml-2 text-xs text-slate-500">
                    Mức độ sẽ được giới hạn theo dạng câu hỏi.
                  </span>
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    name="questionBuilderType"
                    onChange={(event) => {
                      const nextType = event.target.value as typeof questionBuilderType;
                      const nextAllowedDifficulties = allowedDifficultiesByQuestionBuilderType[nextType];
                      const nextDifficulty = nextAllowedDifficulties.includes(questionDifficulty)
                        ? questionDifficulty
                        : nextAllowedDifficulties[0];

                      setQuestionBuilderType(nextType);
                      setQuestionDifficulty(nextDifficulty);
                      setDefaultPointsValue(String(difficultyDefaultPoints[nextDifficulty]));
                    }}
                    value={questionBuilderType}
                  >
                    <option value="multiple_choice_single">Nhiều lựa chọn</option>
                    <option value="multiple_choice_multiple">Nhiều đáp án</option>
                    <option value="true_false">Đúng/Sai</option>
                    <option value="short_answer">Trả lời ngắn</option>
                    <option value="essay">Tự luận</option>
                  </select>
                </label>

                <label className="text-sm text-slate-700 md:col-span-2">
                  Nội dung câu hỏi
                  {questionBuilderType === "essay" ? (
                    <textarea
                      className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      name="prompt"
                      onChange={(event) => setQuestionPromptValue(event.target.value)}
                      placeholder="Nhập nội dung câu hỏi"
                      required
                      value={questionPromptValue}
                    />
                  ) : (
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      name="prompt"
                      onChange={(event) => setQuestionPromptValue(event.target.value)}
                      placeholder="Nhập nội dung câu hỏi"
                      required
                      value={questionPromptValue}
                    />
                  )}
                </label>

                {questionBuilderType === "multiple_choice_single" || questionBuilderType === "multiple_choice_multiple" ? (
                  <div className="md:col-span-2 space-y-3">
                    <p className="text-sm font-medium text-slate-700">Đáp án lựa chọn</p>
                    {choiceRows.map((row, index) => (
                      <div className="flex items-center gap-3" key={row.id}>
                        <input name="choiceRowId" type="hidden" value={row.id} />
                        <input
                          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                          name={`choiceText__${row.id}`}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setChoiceRows((current) => current.map((item) => item.id === row.id ? { ...item, text: nextValue } : item));
                          }}
                          placeholder={`Đáp án ${index + 1}`}
                          type="text"
                          value={row.text}
                        />
                        <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
                          <input
                            checked={row.isCorrect}
                            name={`choiceCorrect__${row.id}`}
                            onChange={(event) => {
                              const nextChecked = event.target.checked;
                              setChoiceRows((current) => current.map((item) => item.id === row.id ? { ...item, isCorrect: nextChecked } : item));
                            }}
                            type="checkbox"
                            value="on"
                          />
                          <span>Đúng</span>
                        </label>
                        {choiceRows.length > 2 ? (
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700"
                            onClick={(event) => {
                              event.preventDefault();
                              setChoiceRows((current) => current.filter((item) => item.id !== row.id));
                            }}
                            type="button"
                          >
                            Bỏ
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                        onClick={(event) => {
                          event.preventDefault();
                          setChoiceRows((current) => [...current, { id: `${Date.now()}-${current.length + 1}`, text: "", isCorrect: false }]);
                        }}
                        type="button"
                      >
                        Thêm đáp án
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {questionBuilderType === "multiple_choice_single"
                        ? "Dạng Nhiều lựa chọn cần chọn đúng 1 đáp án."
                        : "Dạng Nhiều đáp án có thể chọn nhiều đáp án đúng và có thể thêm hơn 4 đáp án."}
                    </p>
                  </div>
                ) : null}

                {questionBuilderType === "true_false" ? (
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Đáp án đúng
                    <select
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      name="trueFalseAnswerKey"
                      onChange={(event) => setTrueFalseAnswerKey(event.target.value)}
                      value={trueFalseAnswerKey}
                    >
                      <option value="Đúng">Đúng</option>
                      <option value="Sai">Sai</option>
                    </select>
                  </label>
                ) : null}

                {questionBuilderType === "short_answer" ? (
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Đáp án đúng
                    <input
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      name="shortAnswerKey"
                      onChange={(event) => setShortAnswerKeyValue(event.target.value)}
                      placeholder="Nhập đáp án đúng"
                      type="text"
                      value={shortAnswerKeyValue}
                    />
                  </label>
                ) : null}

                <label className="text-sm text-slate-700 md:col-span-2">
                  Ghi chú nội bộ
                  <textarea
                    className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    name="explanation"
                    onChange={(event) => setExplanationValue(event.target.value)}
                    placeholder="Ghi chú nội bộ cho người soạn đề. Nội dung này không hiển thị trong bài kiểm tra hoặc kết quả của sinh viên."
                    value={explanationValue}
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Chuẩn đầu ra
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    name="cloCode"
                    onChange={(event) => setSelectedQuestionBankCloCode(event.target.value)}
                    value={selectedQuestionBankCloCode}
                  >
                    <option value="">Chưa gắn CLO</option>
                    {(selectedModeratorCourseMetadata?.cloItems ?? []).map((clo) => (
                      <option key={clo.code} value={clo.code}>
                        {clo.code}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-slate-700">
                  Chương
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    name="chapterLabel"
                    onChange={(event) => setChapterLabelValue(event.target.value)}
                    placeholder="Ví dụ: 2"
                    value={chapterLabelValue}
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Mức độ
                  <select
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    name="difficulty"
                    onChange={(event) => {
                      const nextDifficulty = event.target.value as QuestionDifficulty;
                      setQuestionDifficulty(nextDifficulty);
                      setDefaultPointsValue(String(difficultyDefaultPoints[nextDifficulty]));
                    }}
                    value={questionDifficulty}
                  >
                    {availableQuestionDifficulties.map((difficulty) => (
                      <option key={difficulty} value={difficulty}>
                        {difficultyLabels[difficulty]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm text-slate-700">
                  Điểm mặc định
                  <input
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    min="1"
                    name="defaultPoints"
                    onChange={(event) => setDefaultPointsValue(event.target.value)}
                    type="number"
                    value={defaultPointsValue}
                  />
                </label>

                <div className="md:col-span-2">
                  <button className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60" disabled={isQuestionBankPending} type="submit">
                    {isQuestionBankPending ? "Đang lưu..." : "Thêm câu hỏi vào ngân hàng đề"}
                  </button>
                </div>
              </form>

              {questionBankState.message ? (
                <p className={questionBankState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
                  {questionBankState.message}
                </p>
              ) : null}
            </section>
          ) : null}

          {showModeratorQuestionBankDetail && selectedQuestionBankCourseBundle ? (
            <div className="mt-6">
              {selectedQuestionBankCourseBundle.items.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Học phần này chưa có câu hỏi nào.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full table-fixed border-collapse text-sm">
                    <thead>
                      <tr className="bg-white text-slate-700">
                        <th className="w-[6%] border border-slate-300 px-3 py-2 text-center">STT</th>
                        <th className="w-[50%] border border-slate-300 px-3 py-2 text-center">Nội dung</th>
                        <th className="w-[9%] border border-slate-300 px-3 py-2 text-center">Loại</th>
                        <th className="w-[7%] border border-slate-300 px-3 py-2 text-center">CLO</th>
                        <th className="w-[9%] border border-slate-300 px-3 py-2 text-center">Chương</th>
                        <th className="w-[8%] border border-slate-300 px-3 py-2 text-center">Mức độ</th>
                        <th className="w-[6%] border border-slate-300 px-3 py-2 text-center">Điểm</th>
                        <th className="w-[5%] border border-slate-300 px-3 py-2 text-center">Khả dụng</th>
                        <th className="w-[9%] border border-slate-300 px-3 py-2 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedQuestionBankCourseBundle.items.map((item, index) => (
                        <tr className="align-top" key={item.id}>
                          <td className="border border-slate-300 px-3 py-2 text-center">{index + 1}</td>
                          <td className="border border-slate-300 px-3 py-2">
                            <p className="font-medium text-slate-900">{item.prompt}</p>
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{getQuestionTypeLabel(item)}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{item.cloCode ?? "-"}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{item.chapterLabel ?? "-"}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{difficultyLabels[item.difficulty] ?? item.difficulty}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">{item.defaultPoints}</td>
                          <td className="border border-slate-300 px-3 py-2">
                            <form action={updateQuestionBankItemAvailabilityAction} className="flex items-center justify-center">
                              <input name="courseId" type="hidden" value={selectedQuestionBankCourseBundle.courseId} />
                              <input name="questionBankItemId" type="hidden" value={item.id} />
                              <label className="flex items-center justify-center">
                                <input
                                  defaultChecked={item.isAvailable}
                                  name="isAvailable"
                                  onChange={(event) => event.currentTarget.form?.requestSubmit()}
                                  type="checkbox"
                                  value="on"
                                />
                                <span className="sr-only">{item.isAvailable ? "Khả dụng" : "Không khả dụng"}</span>
                              </label>
                              <button className="sr-only" type="submit">
                                Lưu trạng thái khả dụng
                              </button>
                            </form>
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-center">
                            <form
                              action={deleteQuestionBankAction}
                              onSubmit={(event) => {
                                if (!window.confirm("Xóa câu hỏi này khỏi ngân hàng đề thi?")) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              <input name="courseId" type="hidden" value={selectedQuestionBankCourseBundle.courseId} />
                              <input name="questionBankItemId" type="hidden" value={item.id} />
                              <QuestionBankDeleteSubmitButton />
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {deleteQuestionBankState.message ? (
            <p className={deleteQuestionBankState.status === "error" ? "mt-3 text-sm text-red-600" : "mt-3 text-sm text-emerald-700"}>
              {deleteQuestionBankState.message}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
