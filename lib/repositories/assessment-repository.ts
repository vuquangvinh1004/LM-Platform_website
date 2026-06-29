import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AssessmentSummary, StudentAssessmentView } from "@/lib/types/assessment";
import type { SubmissionStatus } from "@/lib/types/submission";

type AssessmentRow = {
  id: string;
  class_id: string;
  course_id: string;
  title: string;
  description: string | null;
  delivery_mode: "external" | "internal";
  provider: "google_form" | "microsoft_form" | "manual" | "internal" | "other";
  form_url: string | null;
  embed_mode: "iframe" | "new_tab" | "disabled";
  assessment_component_type: "diagnostic" | "frequent" | "periodic" | "final" | null;
  assessment_clo_codes: string[] | null;
  attempt_limit: number;
  shuffle_questions: boolean;
  show_feedback_after_submit: boolean;
  time_limit_minutes: number | null;
  status: "draft" | "open" | "closed" | "archived";
  open_at: string | null;
  due_at: string | null;
  results_locked_at: string | null;
  results_locked_by: string | null;
  results_published_at: string | null;
  results_published_by: string | null;
  created_at: string;
  classes: {
    class_code: string;
    title: string;
  } | null;
  courses: {
    code: string;
    title: string;
  } | null;
};

type LegacyAssessmentRow = Omit<
  AssessmentRow,
  "assessment_component_type" | "assessment_clo_codes" | "results_locked_at" | "results_locked_by" | "results_published_at" | "results_published_by"
>;

type StudentSubmissionStatusRow = {
  assessment_id: string;
  status: SubmissionStatus;
};

const ASSESSMENT_SELECT =
  "id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,assessment_component_type,assessment_clo_codes,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,results_locked_at,results_locked_by,results_published_at,results_published_by,created_at,classes(class_code,title),courses(code,title)";

const LEGACY_ASSESSMENT_SELECT =
  "id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,created_at,classes(class_code,title),courses(code,title)";

function isMissingAssessmentComponentColumnsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorLike = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof errorLike.code === "string" ? errorLike.code : "";
  const message = [
    typeof errorLike.message === "string" ? errorLike.message : "",
    typeof errorLike.details === "string" ? errorLike.details : "",
    typeof errorLike.hint === "string" ? errorLike.hint : "",
  ].join(" ");

  return (code === "42703" || code === "PGRST204")
    && (message.includes("assessment_component_type") || message.includes("assessment_clo_codes"));
}

function isMissingAssessmentResultWorkflowColumnsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const errorLike = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof errorLike.code === "string" ? errorLike.code : "";
  const message = [
    typeof errorLike.message === "string" ? errorLike.message : "",
    typeof errorLike.details === "string" ? errorLike.details : "",
    typeof errorLike.hint === "string" ? errorLike.hint : "",
  ].join(" ");

  return (code === "42703" || code === "PGRST204")
    && (
      message.includes("results_locked_at")
      || message.includes("results_locked_by")
      || message.includes("results_published_at")
      || message.includes("results_published_by")
    );
}

function mapAssessmentSummary(row: AssessmentRow | LegacyAssessmentRow): AssessmentSummary {
  const assessmentComponentType = "assessment_component_type" in row ? row.assessment_component_type ?? undefined : undefined;
  const assessmentCloCodes = "assessment_clo_codes" in row ? row.assessment_clo_codes ?? [] : [];
  const resultsLockedAt = "results_locked_at" in row ? row.results_locked_at ?? undefined : undefined;
  const resultsLockedBy = "results_locked_by" in row ? row.results_locked_by ?? undefined : undefined;
  const resultsPublishedAt = "results_published_at" in row ? row.results_published_at ?? undefined : undefined;
  const resultsPublishedBy = "results_published_by" in row ? row.results_published_by ?? undefined : undefined;

  return {
    id: row.id,
    classId: row.class_id,
    courseId: row.course_id,
    classCode: row.classes?.class_code ?? "",
    classTitle: row.classes?.title ?? "",
    courseCode: row.courses?.code ?? "",
    courseTitle: row.courses?.title ?? "",
    title: row.title,
    description: row.description ?? undefined,
    deliveryMode: row.delivery_mode,
    provider: row.provider,
    formUrl: row.form_url ?? undefined,
    embedMode: row.embed_mode,
    assessmentComponentType,
    assessmentCloCodes,
    attemptLimit: row.attempt_limit,
    shuffleQuestions: row.shuffle_questions,
    showFeedbackAfterSubmit: row.show_feedback_after_submit,
    timeLimitMinutes: row.time_limit_minutes ?? undefined,
    status: row.status,
    openAt: row.open_at ?? undefined,
    dueAt: row.due_at ?? undefined,
    resultsLockedAt,
    resultsLockedBy,
    resultsPublishedAt,
    resultsPublishedBy,
    createdAt: row.created_at,
  };
}

/**
 * Creates a new assessment row for a manageable class.
 */
export async function createAssessmentRepository(input: {
  classId: string;
  courseId: string;
  actorId: string;
  title: string;
  description?: string;
  deliveryMode: "external" | "internal";
  provider: "google_form" | "microsoft_form" | "manual" | "internal" | "other";
  formUrl?: string;
  embedMode: "iframe" | "new_tab" | "disabled";
  assessmentComponentType: "diagnostic" | "frequent" | "periodic" | "final";
  assessmentCloCodes: string[];
  maxScore?: number;
  attemptLimit: number;
  shuffleQuestions: boolean;
  showFeedbackAfterSubmit: boolean;
  timeLimitMinutes?: number;
  openAt?: string;
  dueAt?: string;
  status: "draft" | "open" | "closed" | "archived";
}): Promise<AssessmentSummary> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("assessments")
    .insert({
      class_id: input.classId,
      course_id: input.courseId,
      created_by: input.actorId,
      title: input.title,
      description: input.description ?? null,
      delivery_mode: input.deliveryMode,
      provider: input.provider,
      form_url: input.formUrl ?? null,
      embed_mode: input.embedMode,
      assessment_component_type: input.assessmentComponentType,
      assessment_clo_codes: input.assessmentCloCodes,
      max_score: input.maxScore ?? null,
      attempt_limit: input.attemptLimit,
      shuffle_questions: input.shuffleQuestions,
      show_feedback_after_submit: input.showFeedbackAfterSubmit,
      time_limit_minutes: input.timeLimitMinutes ?? null,
      open_at: input.openAt ?? null,
      due_at: input.dueAt ?? null,
      status: input.status,
    })
    .select(ASSESSMENT_SELECT)
    .single<AssessmentRow>();

  if (error) {
    throw error;
  }

  return mapAssessmentSummary(data);
}

/**
 * Updates status for one manageable assessment row.
 */
export async function updateAssessmentStatusRepository(input: {
  assessmentId: string;
  status: "draft" | "open" | "closed" | "archived";
}): Promise<AssessmentSummary | null> {
  const supabase = await createServerSupabaseClient();
  const updatePayload = {
    status: input.status,
  };

  const buildQuery = () =>
    supabase
      .from("assessments")
      .update(updatePayload)
      .eq("id", input.assessmentId);

  const { data, error } = await buildQuery().select(ASSESSMENT_SELECT).maybeSingle<AssessmentRow>();

  if (error && !isMissingAssessmentComponentColumnsError(error) && !isMissingAssessmentResultWorkflowColumnsError(error)) {
    throw error;
  }

  if (!error) {
    return data ? mapAssessmentSummary(data) : null;
  }

  const legacyResult = await buildQuery().select(LEGACY_ASSESSMENT_SELECT).maybeSingle<LegacyAssessmentRow>();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return legacyResult.data ? mapAssessmentSummary(legacyResult.data) : null;
}

export async function deleteAssessmentRepository(assessmentId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  const { error, count } = await supabase
    .from("assessments")
    .delete({ count: "exact" })
    .eq("id", assessmentId);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

export async function getAssessmentSummaryRepository(assessmentId: string): Promise<AssessmentSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(ASSESSMENT_SELECT)
    .eq("id", assessmentId)
    .maybeSingle<AssessmentRow>();

  if (error && !isMissingAssessmentComponentColumnsError(error) && !isMissingAssessmentResultWorkflowColumnsError(error)) {
    throw error;
  }

  if (!error) {
    return data ? mapAssessmentSummary(data) : null;
  }

  const legacyResult = await supabase
    .from("assessments")
    .select(LEGACY_ASSESSMENT_SELECT)
    .eq("id", assessmentId)
    .maybeSingle<LegacyAssessmentRow>();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return legacyResult.data ? mapAssessmentSummary(legacyResult.data) : null;
}

/**
 * Lists assessments that current manager can read by RLS scope.
 */
export async function listAssessmentsForManagerRepository(input: {
  classId?: string;
}): Promise<AssessmentSummary[]> {
  const supabase = await createServerSupabaseClient();
  const buildQuery = (selectClause: string) => {
    let query = supabase
      .from("assessments")
      .select(selectClause)
      .order("created_at", { ascending: false })
      .limit(200);

    if (input.classId) {
      query = query.eq("class_id", input.classId);
    }

    return query;
  };

  const { data, error } = await buildQuery(ASSESSMENT_SELECT).returns<AssessmentRow[]>();

  if (error && !isMissingAssessmentComponentColumnsError(error) && !isMissingAssessmentResultWorkflowColumnsError(error)) {
    throw error;
  }

  if (!error) {
    return (data ?? []).map(mapAssessmentSummary);
  }

  const legacyResult = await buildQuery(LEGACY_ASSESSMENT_SELECT).returns<LegacyAssessmentRow[]>();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return (legacyResult.data ?? []).map(mapAssessmentSummary);
}

/**
 * Lists student-visible assessments under active membership RLS.
 */
export async function listAssessmentsForStudentRepository(input?: { classId?: string }): Promise<AssessmentSummary[]> {
  const supabase = await createServerSupabaseClient();
  const buildQuery = (selectClause: string) => {
    let query = supabase
      .from("assessments")
      .select(selectClause)
      .in("status", ["draft", "open", "closed"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (input?.classId) {
      query = query.eq("class_id", input.classId);
    }

    return query;
  };

  const { data, error } = await buildQuery(ASSESSMENT_SELECT).returns<AssessmentRow[]>();

  if (error && !isMissingAssessmentComponentColumnsError(error) && !isMissingAssessmentResultWorkflowColumnsError(error)) {
    throw error;
  }

  if (!error) {
    return (data ?? []).map(mapAssessmentSummary);
  }

  const legacyResult = await buildQuery(LEGACY_ASSESSMENT_SELECT).returns<LegacyAssessmentRow[]>();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return (legacyResult.data ?? []).map(mapAssessmentSummary);
}

/**
 * Lists assessment ids with completed submissions for the current student.
 */
export async function listCompletedAssessmentIdsForStudentRepository(input: {
  studentId: string;
  assessmentIds: string[];
}): Promise<Set<string>> {
  if (input.assessmentIds.length === 0) {
    return new Set();
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submissions")
    .select("assessment_id,status")
    .eq("student_id", input.studentId)
    .in("assessment_id", input.assessmentIds)
    .in("status", ["submitted", "late"])
    .returns<StudentSubmissionStatusRow[]>();

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.assessment_id));
}

/**
 * Gets one student assessment view if visible by membership and status rules.
 */
export async function getAssessmentForStudentRepository(assessmentId: string): Promise<StudentAssessmentView | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("assessments")
    .select(ASSESSMENT_SELECT)
    .eq("id", assessmentId)
    .maybeSingle<AssessmentRow>();

  if (error && !isMissingAssessmentComponentColumnsError(error) && !isMissingAssessmentResultWorkflowColumnsError(error)) {
    throw error;
  }

  let row: AssessmentRow | LegacyAssessmentRow | null = data ?? null;

  if (error) {
    const legacyResult = await supabase
      .from("assessments")
      .select(LEGACY_ASSESSMENT_SELECT)
      .eq("id", assessmentId)
      .maybeSingle<LegacyAssessmentRow>();

    if (legacyResult.error) {
      throw legacyResult.error;
    }

    row = legacyResult.data ?? null;
  }

  if (!row) {
    return null;
  }

  const summary = mapAssessmentSummary(row);

  return {
    id: summary.id,
    classId: summary.classId,
    classCode: summary.classCode,
    classTitle: summary.classTitle,
    title: summary.title,
    description: summary.description,
    deliveryMode: summary.deliveryMode,
    provider: summary.provider,
    formUrl: summary.formUrl,
    embedMode: summary.embedMode,
    assessmentComponentType: summary.assessmentComponentType,
    assessmentCloCodes: summary.assessmentCloCodes,
    attemptLimit: summary.attemptLimit,
    shuffleQuestions: summary.shuffleQuestions,
    showFeedbackAfterSubmit: summary.showFeedbackAfterSubmit,
    timeLimitMinutes: summary.timeLimitMinutes,
    status: summary.status,
    openAt: summary.openAt,
    dueAt: summary.dueAt,
  };
}

export async function updateAssessmentResultsWorkflowRepository(input: {
  assessmentId: string;
  resultsLockedAt?: string | null;
  resultsLockedBy?: string | null;
  resultsPublishedAt?: string | null;
  resultsPublishedBy?: string | null;
}): Promise<AssessmentSummary | null> {
  const supabase = await createServerSupabaseClient();
  const updatePayload = {
    results_locked_at: input.resultsLockedAt ?? null,
    results_locked_by: input.resultsLockedBy ?? null,
    results_published_at: input.resultsPublishedAt ?? null,
    results_published_by: input.resultsPublishedBy ?? null,
  };

  const { data, error } = await supabase
    .from("assessments")
    .update(updatePayload)
    .eq("id", input.assessmentId)
    .select(ASSESSMENT_SELECT)
    .maybeSingle<AssessmentRow>();

  if (error && !isMissingAssessmentComponentColumnsError(error) && !isMissingAssessmentResultWorkflowColumnsError(error)) {
    throw error;
  }

  if (!error) {
    return data ? mapAssessmentSummary(data) : null;
  }

  const legacyResult = await supabase
    .from("assessments")
    .update(updatePayload)
    .eq("id", input.assessmentId)
    .select(LEGACY_ASSESSMENT_SELECT)
    .maybeSingle<LegacyAssessmentRow>();

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return legacyResult.data ? mapAssessmentSummary(legacyResult.data) : null;
}
