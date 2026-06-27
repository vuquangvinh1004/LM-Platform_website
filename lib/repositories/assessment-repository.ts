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
  attempt_limit: number;
  shuffle_questions: boolean;
  show_feedback_after_submit: boolean;
  time_limit_minutes: number | null;
  status: "draft" | "open" | "closed" | "archived";
  open_at: string | null;
  due_at: string | null;
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

type StudentSubmissionStatusRow = {
  assessment_id: string;
  status: SubmissionStatus;
};

function mapAssessmentSummary(row: AssessmentRow): AssessmentSummary {
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
    attemptLimit: row.attempt_limit,
    shuffleQuestions: row.shuffle_questions,
    showFeedbackAfterSubmit: row.show_feedback_after_submit,
    timeLimitMinutes: row.time_limit_minutes ?? undefined,
    status: row.status,
    openAt: row.open_at ?? undefined,
    dueAt: row.due_at ?? undefined,
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
      max_score: input.maxScore ?? null,
      attempt_limit: input.attemptLimit,
      shuffle_questions: input.shuffleQuestions,
      show_feedback_after_submit: input.showFeedbackAfterSubmit,
      time_limit_minutes: input.timeLimitMinutes ?? null,
      open_at: input.openAt ?? null,
      due_at: input.dueAt ?? null,
      status: input.status,
    })
    .select("id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,created_at,classes(class_code,title),courses(code,title)")
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

  const { data, error } = await supabase
    .from("assessments")
    .update({
      status: input.status,
    })
    .eq("id", input.assessmentId)
    .select("id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,created_at,classes(class_code,title),courses(code,title)")
    .maybeSingle<AssessmentRow>();

  if (error) {
    throw error;
  }

  return data ? mapAssessmentSummary(data) : null;
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
    .select("id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,created_at,classes(class_code,title),courses(code,title)")
    .eq("id", assessmentId)
    .maybeSingle<AssessmentRow>();

  if (error) {
    throw error;
  }

  return data ? mapAssessmentSummary(data) : null;
}

/**
 * Lists assessments that current manager can read by RLS scope.
 */
export async function listAssessmentsForManagerRepository(input: {
  classId?: string;
}): Promise<AssessmentSummary[]> {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("assessments")
    .select("id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,created_at,classes(class_code,title),courses(code,title)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (input.classId) {
    query = query.eq("class_id", input.classId);
  }

  const { data, error } = await query.returns<AssessmentRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAssessmentSummary);
}

/**
 * Lists student-visible assessments under active membership RLS.
 */
export async function listAssessmentsForStudentRepository(input?: { classId?: string }): Promise<AssessmentSummary[]> {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("assessments")
    .select("id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,created_at,classes(class_code,title),courses(code,title)")
    .in("status", ["draft", "open", "closed"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (input?.classId) {
    query = query.eq("class_id", input.classId);
  }

  const { data, error } = await query.returns<AssessmentRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapAssessmentSummary);
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
    .select("id,class_id,course_id,title,description,delivery_mode,provider,form_url,embed_mode,attempt_limit,shuffle_questions,show_feedback_after_submit,time_limit_minutes,status,open_at,due_at,created_at,classes(class_code,title),courses(code,title)")
    .eq("id", assessmentId)
    .maybeSingle<AssessmentRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    classId: data.class_id,
    classCode: data.classes?.class_code ?? "",
    classTitle: data.classes?.title ?? "",
    title: data.title,
    description: data.description ?? undefined,
    deliveryMode: data.delivery_mode,
    provider: data.provider,
    formUrl: data.form_url ?? undefined,
    embedMode: data.embed_mode,
    attemptLimit: data.attempt_limit,
    shuffleQuestions: data.shuffle_questions,
    showFeedbackAfterSubmit: data.show_feedback_after_submit,
    timeLimitMinutes: data.time_limit_minutes ?? undefined,
    status: data.status,
    openAt: data.open_at ?? undefined,
    dueAt: data.due_at ?? undefined,
  };
}
