import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CourseAssessmentResultItem, QuestionBankItem } from "@/lib/types/question-bank";
import type { QuestionDifficulty } from "@/lib/types/question-bank";
import type { SubmissionSource, SubmissionStatus } from "@/lib/types/submission";

type QuestionBankRow = {
  id: string;
  course_id: string;
  created_by: string;
  prompt: string;
  question_type: "multiple_choice" | "true_false" | "short_answer" | "essay";
  choices: string[] | null;
  answer_key: unknown;
  explanation: string | null;
  clo_code: string | null;
  chapter_label: string | null;
  difficulty: QuestionDifficulty;
  default_points: number;
  is_available: boolean | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type CourseAssessmentResultRow = {
  id: string;
  course_id: string;
  class_id: string;
  assessment_id: string;
  submission_id: string;
  student_id: string;
  student_identifier: string;
  attempt_number: number;
  raw_score: number | null;
  max_score: number | null;
  normalized_score: number | null;
  status: SubmissionStatus;
  source: SubmissionSource;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapQuestionBankRow(row: QuestionBankRow): QuestionBankItem {
  return {
    id: row.id,
    courseId: row.course_id,
    createdBy: row.created_by,
    prompt: row.prompt,
    questionType: row.question_type,
    choices: row.choices ?? [],
    answerKey: row.answer_key,
    explanation: row.explanation,
    cloCode: row.clo_code,
    chapterLabel: row.chapter_label,
    difficulty: row.difficulty,
    defaultPoints: row.default_points,
    isAvailable: row.is_available ?? false,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCourseAssessmentResultRow(row: CourseAssessmentResultRow): CourseAssessmentResultItem {
  return {
    id: row.id,
    courseId: row.course_id,
    classId: row.class_id,
    assessmentId: row.assessment_id,
    submissionId: row.submission_id,
    studentId: row.student_id,
    studentIdentifier: row.student_identifier,
    attemptNumber: row.attempt_number,
    rawScore: row.raw_score,
    maxScore: row.max_score,
    normalizedScore: row.normalized_score,
    status: row.status,
    source: row.source,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listQuestionBankItemsForCourseRepository(courseId: string): Promise<QuestionBankItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("question_bank_items")
    .select("id,course_id,created_by,prompt,question_type,choices,answer_key,explanation,clo_code,chapter_label,difficulty,default_points,is_available,status,created_at,updated_at")
    .eq("course_id", courseId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<QuestionBankRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapQuestionBankRow);
}

export async function listQuestionBankItemsForCoursesRepository(courseIds: string[]): Promise<QuestionBankItem[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("question_bank_items")
    .select("id,course_id,created_by,prompt,question_type,choices,answer_key,explanation,clo_code,chapter_label,difficulty,default_points,is_available,status,created_at,updated_at")
    .in("course_id", courseIds)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .returns<QuestionBankRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapQuestionBankRow);
}

export async function createQuestionBankItemRepository(input: {
  courseId: string;
  actorId: string;
  prompt: string;
  questionType: QuestionBankRow["question_type"];
  choices: string[];
  answerKey: unknown;
  explanation?: string;
  cloCode?: string;
  chapterLabel?: string;
  difficulty: QuestionDifficulty;
  defaultPoints: number;
}): Promise<QuestionBankItem> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("question_bank_items")
    .insert({
      course_id: input.courseId,
      created_by: input.actorId,
      prompt: input.prompt,
      question_type: input.questionType,
      choices: input.choices,
      answer_key: input.answerKey,
      explanation: input.explanation ?? null,
      clo_code: input.cloCode ?? null,
      chapter_label: input.chapterLabel ?? null,
      difficulty: input.difficulty,
      default_points: input.defaultPoints,
      is_available: true,
      status: "active",
    })
    .select("id,course_id,created_by,prompt,question_type,choices,answer_key,explanation,clo_code,chapter_label,difficulty,default_points,is_available,status,created_at,updated_at")
    .single<QuestionBankRow>();

  if (error) {
    throw error;
  }

  return mapQuestionBankRow(data);
}

export async function attachQuestionBankItemsToAssessmentRepository(input: {
  assessmentId: string;
  questionIds: string[];
}): Promise<void> {
  if (input.questionIds.length === 0) {
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { data: questions, error: questionError } = await supabase
    .from("question_bank_items")
    .select("id,prompt,question_type,choices,answer_key,explanation,default_points,is_available")
    .in("id", input.questionIds);

  if (questionError) {
    throw questionError;
  }

  const unavailableQuestion = (questions ?? []).find((question) => question.is_available !== true);

  if (unavailableQuestion) {
    throw new Error("Có câu hỏi trong ngân hàng đề chưa được GIÁM SÁT VIÊN bật khả dụng cho giảng viên.");
  }

  const rows = (questions ?? []).map((question, index) => ({
    assessment_id: input.assessmentId,
    question_bank_item_id: question.id,
    sort_order: index + 1,
    points_override: question.default_points,
    snapshot_prompt: question.prompt,
    snapshot_question_type: question.question_type,
    snapshot_choices: question.choices ?? [],
    snapshot_answer_key: question.answer_key ?? null,
    snapshot_explanation: question.explanation ?? null,
  }));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("assessment_question_links").insert(rows);

  if (error) {
    throw error;
  }
}

export async function updateQuestionBankItemRepository(input: {
  questionBankItemId: string;
  prompt: string;
  questionType: QuestionBankRow["question_type"];
  choices: string[];
  answerKey: unknown;
  explanation?: string;
  cloCode?: string;
  chapterLabel?: string;
  difficulty: QuestionDifficulty;
  defaultPoints: number;
}): Promise<QuestionBankItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("question_bank_items")
    .update({
      prompt: input.prompt,
      question_type: input.questionType,
      choices: input.choices,
      answer_key: input.answerKey,
      explanation: input.explanation ?? null,
      clo_code: input.cloCode ?? null,
      chapter_label: input.chapterLabel ?? null,
      difficulty: input.difficulty,
      default_points: input.defaultPoints,
    })
    .eq("id", input.questionBankItemId)
    .eq("status", "active")
    .select("id,course_id,created_by,prompt,question_type,choices,answer_key,explanation,clo_code,chapter_label,difficulty,default_points,is_available,status,created_at,updated_at")
    .maybeSingle<QuestionBankRow>();

  if (error) {
    throw error;
  }

  return data ? mapQuestionBankRow(data) : null;
}

export async function updateQuestionBankItemAvailabilityRepository(input: {
  questionBankItemId: string;
  isAvailable: boolean;
}): Promise<QuestionBankItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("question_bank_items")
    .update({
      is_available: input.isAvailable,
    })
    .eq("id", input.questionBankItemId)
    .eq("status", "active")
    .select("id,course_id,created_by,prompt,question_type,choices,answer_key,explanation,clo_code,chapter_label,difficulty,default_points,is_available,status,created_at,updated_at")
    .maybeSingle<QuestionBankRow>();

  if (error) {
    throw error;
  }

  return data ? mapQuestionBankRow(data) : null;
}

export async function archiveQuestionBankItemRepository(questionBankItemId: string): Promise<QuestionBankItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("question_bank_items")
    .update({
      status: "archived",
      is_available: false,
    })
    .eq("id", questionBankItemId)
    .eq("status", "active")
    .select("id,course_id,created_by,prompt,question_type,choices,answer_key,explanation,clo_code,chapter_label,difficulty,default_points,is_available,status,created_at,updated_at")
    .maybeSingle<QuestionBankRow>();

  if (error) {
    throw error;
  }

  return data ? mapQuestionBankRow(data) : null;
}

export async function upsertCourseAssessmentResultRepository(input: {
  courseId: string;
  classId: string;
  assessmentId: string;
  submissionId: string;
  studentId: string;
  studentIdentifier: string;
  attemptNumber: number;
  rawScore?: number;
  maxScore?: number;
  normalizedScore?: number;
  status: SubmissionStatus;
  source: SubmissionSource;
  submittedAt?: string;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("course_assessment_results")
    .upsert({
      course_id: input.courseId,
      class_id: input.classId,
      assessment_id: input.assessmentId,
      submission_id: input.submissionId,
      student_id: input.studentId,
      student_identifier: input.studentIdentifier,
      attempt_number: input.attemptNumber,
      raw_score: input.rawScore ?? null,
      max_score: input.maxScore ?? null,
      normalized_score: input.normalizedScore ?? null,
      status: input.status,
      source: input.source,
      submitted_at: input.submittedAt ?? null,
    }, {
      onConflict: "submission_id",
    });

  if (error) {
    throw error;
  }
}

export async function listCourseAssessmentResultsRepository(courseId: string): Promise<CourseAssessmentResultItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("course_assessment_results")
    .select("id,course_id,class_id,assessment_id,submission_id,student_id,student_identifier,attempt_number,raw_score,max_score,normalized_score,status,source,submitted_at,created_at,updated_at")
    .eq("course_id", courseId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<CourseAssessmentResultRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCourseAssessmentResultRow);
}

export async function listCourseAssessmentResultsByCourseIdsRepository(courseIds: string[]): Promise<CourseAssessmentResultItem[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("course_assessment_results")
    .select("id,course_id,class_id,assessment_id,submission_id,student_id,student_identifier,attempt_number,raw_score,max_score,normalized_score,status,source,submitted_at,created_at,updated_at")
    .in("course_id", courseIds)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<CourseAssessmentResultRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapCourseAssessmentResultRow);
}
