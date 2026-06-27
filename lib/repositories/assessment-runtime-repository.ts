import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AssessmentAuthoringMode } from "@/lib/types/assessment";
import type {
  AssessmentAnswerRecord,
  AssessmentAnswerScoreView,
  AssessmentAttemptGradingView,
  AssessmentAttemptSummary,
  InternalAssessmentDefinition,
  StudentAssessmentAttemptView,
} from "@/lib/types/assessment-runtime";
import type { QuestionType } from "@/lib/types/question-bank";

type AssessmentAuthoringModeRow = {
  id: string;
  delivery_mode: "external" | "internal";
  provider: "google_form" | "microsoft_form" | "manual" | "internal" | "other";
  embed_mode: "iframe" | "new_tab" | "disabled";
};

type AssessmentQuestionLinkRow = {
  question_bank_item_id: string;
  sort_order: number;
  points_override: number | null;
  snapshot_prompt: string;
  snapshot_question_type: QuestionType;
  snapshot_choices: string[] | null;
  snapshot_answer_key: unknown;
  snapshot_explanation: string | null;
  question_bank_items: {
    default_points: number;
  } | null;
};

type InternalAssessmentDefinitionRow = {
  id: string;
  class_id: string;
  course_id: string;
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed" | "archived";
  delivery_mode: "external" | "internal";
  attempt_limit: number;
  shuffle_questions: boolean;
  show_feedback_after_submit: boolean;
  time_limit_minutes: number | null;
  open_at: string | null;
  due_at: string | null;
  classes: {
    class_code: string;
    title: string;
  } | null;
  courses: {
    code: string;
    title: string;
  } | null;
  assessment_question_links: AssessmentQuestionLinkRow[] | null;
};

type AssessmentAttemptRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  status: "in_progress" | "submitted" | "auto_graded" | "graded" | "abandoned" | "expired";
  started_at: string;
  submitted_at: string | null;
  expires_at: string | null;
  auto_graded_at: string | null;
  graded_at: string | null;
  metadata: Record<string, unknown> | null;
};

type AssessmentAnswerRow = {
  attempt_id: string;
  assessment_id: string;
  question_bank_item_id: string;
  sort_order: number;
  answer_payload: Record<string, unknown> | null;
  answered_at: string | null;
  is_final: boolean;
};

type AssessmentAttemptWithAnswersRow = AssessmentAttemptRow & {
  assessment_answers: AssessmentAnswerRow[] | null;
};

type AssessmentAnswerScoreRow = {
  attempt_id: string;
  question_bank_item_id: string;
  auto_score: number | null;
  manual_score: number | null;
  final_score: number | null;
  grader_id: string | null;
  feedback: string | null;
  graded_at: string | null;
};

type AssessmentAttemptWithGradingRow = AssessmentAttemptRow & {
  profiles: {
    full_name: string;
    email: string | null;
    student_code: string | null;
  } | null;
  assessment_answers: AssessmentAnswerRow[] | null;
  assessment_answer_scores: AssessmentAnswerScoreRow[] | null;
};

function mapAssessmentAttemptSummary(row: AssessmentAttemptRow): AssessmentAttemptSummary {
  return {
    id: row.id,
    assessmentId: row.assessment_id,
    studentId: row.student_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    startedAt: row.started_at,
    submittedAt: row.submitted_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    autoGradedAt: row.auto_graded_at ?? undefined,
    gradedAt: row.graded_at ?? undefined,
    metadata: row.metadata ?? {},
  };
}

function mapAssessmentAnswerRecord(row: AssessmentAnswerRow): AssessmentAnswerRecord {
  return {
    attemptId: row.attempt_id,
    assessmentId: row.assessment_id,
    questionBankItemId: row.question_bank_item_id,
    sortOrder: row.sort_order,
    answerPayload: row.answer_payload ?? {},
    answeredAt: row.answered_at ?? undefined,
    isFinal: row.is_final,
  };
}

function mapAssessmentAnswerScoreView(row: AssessmentAnswerScoreRow): AssessmentAnswerScoreView {
  return {
    attemptId: row.attempt_id,
    questionBankItemId: row.question_bank_item_id,
    autoScore: row.auto_score ?? undefined,
    manualScore: row.manual_score ?? undefined,
    finalScore: row.final_score ?? undefined,
    graderId: row.grader_id ?? undefined,
    feedback: row.feedback ?? undefined,
    gradedAt: row.graded_at ?? undefined,
  };
}

export async function getAssessmentAuthoringModeRepository(assessmentId: string): Promise<AssessmentAuthoringMode | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("id,delivery_mode,provider,embed_mode")
    .eq("id", assessmentId)
    .maybeSingle<AssessmentAuthoringModeRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    assessmentId: data.id,
    deliveryMode: data.delivery_mode,
    provider: data.provider,
    embedMode: data.embed_mode,
  };
}

export async function getInternalAssessmentDefinitionRepository(assessmentId: string): Promise<InternalAssessmentDefinition | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessments")
    .select(`
      id,
      class_id,
      course_id,
      title,
      description,
      status,
      delivery_mode,
      attempt_limit,
      shuffle_questions,
      show_feedback_after_submit,
      time_limit_minutes,
      open_at,
      due_at,
      classes(class_code,title),
      courses(code,title),
      assessment_question_links(
        question_bank_item_id,
        sort_order,
        points_override,
        snapshot_prompt,
        snapshot_question_type,
        snapshot_choices,
        snapshot_answer_key,
        snapshot_explanation,
        question_bank_items(default_points)
      )
    `)
    .eq("id", assessmentId)
    .maybeSingle<InternalAssessmentDefinitionRow>();

  if (error) {
    throw error;
  }

  if (!data || data.delivery_mode !== "internal") {
    return null;
  }

  const questions = (data.assessment_question_links ?? [])
    .slice()
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((row) => ({
      questionBankItemId: row.question_bank_item_id,
      sortOrder: row.sort_order,
      prompt: row.snapshot_prompt,
      questionType: row.snapshot_question_type,
      choices: row.snapshot_choices ?? [],
      answerKey: row.snapshot_answer_key,
      explanation: row.snapshot_explanation,
      points: row.points_override ?? row.question_bank_items?.default_points ?? 1,
    }));

  return {
    assessmentId: data.id,
    classId: data.class_id,
    classCode: data.classes?.class_code ?? "",
    classTitle: data.classes?.title ?? "",
    courseId: data.course_id,
    courseCode: data.courses?.code ?? "",
    courseTitle: data.courses?.title ?? "",
    title: data.title,
    description: data.description ?? undefined,
    status: data.status,
    attemptLimit: data.attempt_limit,
    shuffleQuestions: data.shuffle_questions,
    showFeedbackAfterSubmit: data.show_feedback_after_submit,
    timeLimitMinutes: data.time_limit_minutes ?? undefined,
    openAt: data.open_at ?? undefined,
    dueAt: data.due_at ?? undefined,
    questions,
  };
}

export async function findStudentAssessmentAttemptRepository(input: {
  assessmentId: string;
  studentId: string;
  attemptId?: string;
}): Promise<StudentAssessmentAttemptView> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("assessment_attempts")
    .select(`
      id,
      assessment_id,
      student_id,
      attempt_number,
      status,
      started_at,
      submitted_at,
      expires_at,
      auto_graded_at,
      graded_at,
      metadata,
      assessment_answers(
        attempt_id,
        assessment_id,
        question_bank_item_id,
        sort_order,
        answer_payload,
        answered_at,
        is_final
      )
    `)
    .eq("assessment_id", input.assessmentId)
    .eq("student_id", input.studentId)
    .order("attempt_number", { ascending: false })
    .limit(1);

  if (input.attemptId) {
    query = query.eq("id", input.attemptId);
  }

  const { data, error } = await query.maybeSingle<AssessmentAttemptWithAnswersRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return {
      attempt: null,
      answers: [],
    };
  }

  return {
    attempt: mapAssessmentAttemptSummary(data),
    answers: (data.assessment_answers ?? []).sort((left, right) => left.sort_order - right.sort_order).map(mapAssessmentAnswerRecord),
  };
}

export async function createAssessmentAttemptRepository(input: {
  assessmentId: string;
  studentId: string;
  attemptNumber: number;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<AssessmentAttemptSummary> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessment_attempts")
    .insert({
      assessment_id: input.assessmentId,
      student_id: input.studentId,
      attempt_number: input.attemptNumber,
      status: "in_progress",
      expires_at: input.expiresAt ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id,assessment_id,student_id,attempt_number,status,started_at,submitted_at,expires_at,auto_graded_at,graded_at,metadata")
    .single<AssessmentAttemptRow>();

  if (error) {
    throw error;
  }

  return mapAssessmentAttemptSummary(data);
}

export async function upsertAssessmentAnswerRepository(input: {
  attemptId: string;
  assessmentId: string;
  questionBankItemId: string;
  sortOrder: number;
  answerPayload: Record<string, unknown>;
  isFinal: boolean;
}): Promise<AssessmentAnswerRecord> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessment_answers")
    .upsert({
      attempt_id: input.attemptId,
      assessment_id: input.assessmentId,
      question_bank_item_id: input.questionBankItemId,
      sort_order: input.sortOrder,
      answer_payload: input.answerPayload,
      answered_at: new Date().toISOString(),
      is_final: input.isFinal,
    }, {
      onConflict: "attempt_id,question_bank_item_id",
    })
    .select("attempt_id,assessment_id,question_bank_item_id,sort_order,answer_payload,answered_at,is_final")
    .single<AssessmentAnswerRow>();

  if (error) {
    throw error;
  }

  return mapAssessmentAnswerRecord(data);
}

export async function updateAssessmentAttemptStatusRepository(input: {
  attemptId: string;
  status: "in_progress" | "submitted" | "auto_graded" | "graded" | "abandoned" | "expired";
  submittedAt?: string;
  autoGradedAt?: string;
  gradedAt?: string;
  metadata?: Record<string, unknown>;
}): Promise<AssessmentAttemptSummary> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessment_attempts")
    .update({
      status: input.status,
      submitted_at: input.submittedAt ?? null,
      auto_graded_at: input.autoGradedAt ?? null,
      graded_at: input.gradedAt ?? null,
      metadata: input.metadata,
    })
    .eq("id", input.attemptId)
    .select("id,assessment_id,student_id,attempt_number,status,started_at,submitted_at,expires_at,auto_graded_at,graded_at,metadata")
    .single<AssessmentAttemptRow>();

  if (error) {
    throw error;
  }

  return mapAssessmentAttemptSummary(data);
}

export async function upsertAssessmentAnswerScoreRepository(input: {
  attemptId: string;
  questionBankItemId: string;
  autoScore?: number;
  manualScore?: number;
  finalScore?: number;
  graderId?: string;
  feedback?: string;
  gradedAt?: string;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("assessment_answer_scores")
    .upsert({
      attempt_id: input.attemptId,
      question_bank_item_id: input.questionBankItemId,
      auto_score: input.autoScore ?? null,
      manual_score: input.manualScore ?? null,
      final_score: input.finalScore ?? null,
      grader_id: input.graderId ?? null,
      feedback: input.feedback ?? null,
      graded_at: input.gradedAt ?? null,
    }, {
      onConflict: "attempt_id,question_bank_item_id",
    });

  if (error) {
    throw error;
  }
}

export async function getAssessmentAttemptGradingRepository(attemptId: string): Promise<AssessmentAttemptGradingView | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select(`
      id,
      assessment_id,
      student_id,
      attempt_number,
      status,
      started_at,
      submitted_at,
      expires_at,
      auto_graded_at,
      graded_at,
      metadata,
      profiles(full_name,email,student_code),
      assessment_answers(
        attempt_id,
        assessment_id,
        question_bank_item_id,
        sort_order,
        answer_payload,
        answered_at,
        is_final
      ),
      assessment_answer_scores(
        attempt_id,
        question_bank_item_id,
        auto_score,
        manual_score,
        final_score,
        grader_id,
        feedback,
        graded_at
      )
    `)
    .eq("id", attemptId)
    .maybeSingle<AssessmentAttemptWithGradingRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const studentIdentifier = data.profiles?.student_code ?? data.profiles?.email ?? data.profiles?.full_name ?? data.student_id;

  return {
    attempt: mapAssessmentAttemptSummary(data),
    studentId: data.student_id,
    studentFullName: data.profiles?.full_name ?? studentIdentifier,
    studentEmail: data.profiles?.email ?? undefined,
    studentCode: data.profiles?.student_code ?? undefined,
    studentIdentifier,
    answers: (data.assessment_answers ?? []).sort((left, right) => left.sort_order - right.sort_order).map(mapAssessmentAnswerRecord),
    scores: (data.assessment_answer_scores ?? []).map(mapAssessmentAnswerScoreView),
  };
}

export async function listAssessmentAttemptsForGradingRepository(assessmentId: string): Promise<AssessmentAttemptGradingView[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("assessment_attempts")
    .select(`
      id,
      assessment_id,
      student_id,
      attempt_number,
      status,
      started_at,
      submitted_at,
      expires_at,
      auto_graded_at,
      graded_at,
      metadata,
      profiles(full_name,email,student_code),
      assessment_answers(
        attempt_id,
        assessment_id,
        question_bank_item_id,
        sort_order,
        answer_payload,
        answered_at,
        is_final
      ),
      assessment_answer_scores(
        attempt_id,
        question_bank_item_id,
        auto_score,
        manual_score,
        final_score,
        grader_id,
        feedback,
        graded_at
      )
    `)
    .eq("assessment_id", assessmentId)
    .in("status", ["submitted", "auto_graded", "graded"])
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("started_at", { ascending: false })
    .returns<AssessmentAttemptWithGradingRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const studentIdentifier = row.profiles?.student_code ?? row.profiles?.email ?? row.profiles?.full_name ?? row.student_id;

    return {
      attempt: mapAssessmentAttemptSummary(row),
      studentId: row.student_id,
      studentFullName: row.profiles?.full_name ?? studentIdentifier,
      studentEmail: row.profiles?.email ?? undefined,
      studentCode: row.profiles?.student_code ?? undefined,
      studentIdentifier,
      answers: (row.assessment_answers ?? []).sort((left, right) => left.sort_order - right.sort_order).map(mapAssessmentAnswerRecord),
      scores: (row.assessment_answer_scores ?? []).map(mapAssessmentAnswerScoreView),
    };
  });
}
