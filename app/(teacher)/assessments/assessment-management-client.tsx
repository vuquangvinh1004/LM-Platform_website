"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createAssessmentAction, createQuestionBankItemAction, deleteAssessmentAction, updateAssessmentStatusAction } from "@/app/(teacher)/assessments/actions";
import { initialAssessmentActionState } from "@/app/(teacher)/assessments/assessment-action-state";
import { DateTimePickerField } from "@/components/ui/datetime-picker-field";
import { useRefreshOnSuccess } from "@/lib/hooks/use-refresh-on-success";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/auth";
import type { AssessmentSummary } from "@/lib/types/assessment";
import type { CourseClassSummary } from "@/lib/types/class";
import type { CourseAssessmentComponent, CourseCloItem } from "@/lib/types/course";
import type { QuestionBankItem } from "@/lib/types/question-bank";

type AssessmentManagementClientProps = {
  actorRole: UserRole;
  classes: CourseClassSummary[];
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
  easy: "Dễ",
  medium: "Trung bình",
  hard: "Khó",
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

export function AssessmentManagementClient({
  actorRole,
  classes,
  courseMetadata,
  assessments,
  questionBankByCourse,
}: AssessmentManagementClientProps) {
  const [createState, createAction, isPending] = useActionState(createAssessmentAction, initialAssessmentActionState);
  const [questionBankState, questionBankAction, isQuestionBankPending] = useActionState(
    createQuestionBankItemAction,
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
  const [selectedClassPair, setSelectedClassPair] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"external" | "internal">("external");
  const [creationStatus, setCreationStatus] = useState<AssessmentSummary["status"]>("draft");
  const [attemptLimitDraftValue, setAttemptLimitDraftValue] = useState("2");
  const [questionBuilderType, setQuestionBuilderType] = useState<"multiple_choice_single" | "multiple_choice_multiple" | "true_false" | "short_answer" | "essay">("multiple_choice_single");
  const [pendingStatusOverrides, setPendingStatusOverrides] = useState<Record<string, AssessmentSummary["status"]>>({});
  useRefreshOnSuccess({ status: statusUpdateState.status });
  useRefreshOnSuccess({ status: deleteState.status });

  const selectedCourseId = selectedClassPair.split("::")[1] ?? "";
  const selectedCourseMetadata = courseMetadata.find((course) => course.courseId === selectedCourseId);
  const selectedAssessmentComponents = selectedCourseMetadata?.assessmentComponents ?? [];
  const selectedQuestionBankItems = questionBankByCourse.find((bundle) => bundle.courseId === selectedCourseId)?.items ?? [];
  const [selectedAssessmentComponentType, setSelectedAssessmentComponentType] = useState("");

  useEffect(() => {
    if (!selectedAssessmentComponents.some((component) => component.type === selectedAssessmentComponentType)) {
      setSelectedAssessmentComponentType(selectedAssessmentComponents[0]?.type ?? "");
    }
  }, [selectedAssessmentComponentType, selectedAssessmentComponents]);

  return (
    <div className="space-y-8">
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

      {actorRole === "teacher" ? (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-semibold text-slate-900">Tạo bài kiểm tra cho lớp học</h2>
        <form action={createAction} className="mt-4 grid gap-3 md:grid-cols-2" data-testid="create-assessment-form">
          <label className="text-sm text-slate-700">
            Lớp học phần
            <select
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              name="classCoursePair"
              onChange={(event) => setSelectedClassPair(event.target.value)}
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
              onChange={(event) => setDeliveryMode(event.target.value as "external" | "internal")}
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
              onChange={(event) => setSelectedAssessmentComponentType(event.target.value)}
              required
              value={selectedAssessmentComponentType}
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
            {selectedAssessmentComponentType ? (
              (() => {
                const selectedComponent = selectedAssessmentComponents.find((component) => component.type === selectedAssessmentComponentType);
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

          <div className="md:col-span-2 rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Chọn câu hỏi từ ngân hàng đề của học phần</h3>
            {deliveryMode === "internal" ? (
              <p className="mt-2 text-sm text-slate-600">
                Các câu hỏi được chọn sẽ được snapshot vào bài kiểm tra nội bộ để phục vụ các phase làm bài, lưu đáp án và chấm điểm ngay trong website.
              </p>
            ) : null}
            {!selectedCourseId ? (
              <p className="mt-2 text-sm text-slate-500">Chọn lớp học trước để hiển thị ngân hàng đề tương ứng.</p>
            ) : selectedQuestionBankItems.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Học phần này chưa có câu hỏi nào trong ngân hàng đề.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedQuestionBankItems.map((item) => (
                  <label className="flex items-start gap-2 text-sm text-slate-700" key={item.id}>
                    <input name="questionId" type="checkbox" value={item.id} />
                    <span>
                      <span className="font-medium text-slate-900">{item.prompt}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {questionTypeLabels[item.questionType] ?? item.questionType} | {difficultyLabels[item.difficulty] ?? item.difficulty} | {item.defaultPoints} điểm
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

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

      {actorRole === "teacher" || actorRole === "moderator" || actorRole === "admin" ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Ngân hàng đề thi theo học phần</h2>
          <p className="mt-2 text-sm text-slate-600">
            Mỗi học phần có một kho câu hỏi riêng. Giảng viên có thể tạo câu hỏi ở đây rồi chọn lại khi tạo bài kiểm tra cho lớp học.
          </p>

          <form action={questionBankAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-700">
              Học phần
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="courseId" required>
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
              <select
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="questionBuilderType"
                onChange={(event) => setQuestionBuilderType(event.target.value as typeof questionBuilderType)}
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
                <textarea className="mt-1 min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="prompt" placeholder="Nhập nội dung câu hỏi" required />
              ) : (
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="prompt" placeholder="Nhập nội dung câu hỏi" required />
              )}
            </label>

            {questionBuilderType === "multiple_choice_single" || questionBuilderType === "multiple_choice_multiple" ? (
              <div className="md:col-span-2 space-y-3">
                <p className="text-sm font-medium text-slate-700">Đáp án lựa chọn</p>
                {[1, 2, 3, 4].map((index) => (
                  <div className="flex items-center gap-3" key={index}>
                    <input
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      name={`choice${index}`}
                      placeholder={`Đáp án ${index}`}
                      type="text"
                    />
                    <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
                      <input name={`choice${index}Correct`} type="checkbox" value="on" />
                      <span>Đúng</span>
                    </label>
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  {questionBuilderType === "multiple_choice_single"
                    ? "Dạng Nhiều lựa chọn cần chọn đúng 1 đáp án."
                    : "Dạng Nhiều đáp án có thể chọn nhiều đáp án đúng."}
                </p>
              </div>
            ) : null}

            {questionBuilderType === "true_false" ? (
              <label className="text-sm text-slate-700 md:col-span-2">
                Đáp án đúng
                <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="Đúng" name="trueFalseAnswerKey">
                  <option value="Đúng">Đúng</option>
                  <option value="Sai">Sai</option>
                </select>
              </label>
            ) : null}

            {questionBuilderType === "short_answer" ? (
              <label className="text-sm text-slate-700 md:col-span-2">
                Đáp án đúng
                <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" name="shortAnswerKey" placeholder="Nhập đáp án đúng" type="text" />
              </label>
            ) : null}

            <label className="text-sm text-slate-700 md:col-span-2">
              Hướng dẫn và gợi ý
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                name="explanation"
                placeholder="Nội dung hiển thị cho sinh viên khi trả lời sai để ôn tập lại."
              />
            </label>

            <label className="text-sm text-slate-700">
              Độ khó
              <select className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="medium" name="difficulty">
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
            </label>

            <label className="text-sm text-slate-700">
              Điểm mặc định
              <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="1" min="1" name="defaultPoints" type="number" />
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

          <div className="mt-6 space-y-4">
            {questionBankByCourse.map((course) => (
              <article className="rounded-lg border border-slate-200 p-4" key={course.courseId}>
                <h3 className="font-semibold text-slate-900">{course.courseCode} - {course.courseTitle}</h3>
                {course.items.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">Chưa có câu hỏi nào trong học phần này.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {course.items.map((item) => (
                      <li className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700" key={item.id}>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>{getQuestionTypeLabel(item)}</span>
                          <span>{difficultyLabels[item.difficulty] ?? item.difficulty}</span>
                          <span>{item.defaultPoints} điểm</span>
                        </div>
                        <p className="mt-1 text-slate-900">{item.prompt}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
