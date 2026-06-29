import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { CourseAssessmentComponent } from "@/lib/types/course";
import type { CourseAssessmentPublicationOverview, PublishedCourseAssessmentResultRow } from "@/lib/types/course-assessment-publication";
import type { SubmissionSource, SubmissionStatus } from "@/lib/types/submission";

type AssessmentPublicationAssessmentRow = {
  id: string;
  course_id: string;
  title: string;
  assessment_component_type: "diagnostic" | "frequent" | "periodic" | "final" | null;
  assessment_clo_codes: string[] | null;
  results_locked_at: string | null;
  results_published_at: string | null;
  class: {
    id: string;
    class_code: string;
    title: string;
    academic_year: string | null;
  } | {
    id: string;
    class_code: string;
    title: string;
    academic_year: string | null;
  }[] | null;
};

type SubmissionPublicationRow = {
  id: string;
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
  metadata: Record<string, unknown> | null;
};

type StudentProfileRow = {
  id: string;
  full_name: string | null;
  student_code: string | null;
};

type PublishedCourseAssessmentResultRowDb = {
  id: string;
  course_id: string;
  class_id: string;
  assessment_id: string;
  submission_id: string;
  student_id: string;
  student_identifier: string;
  student_code_snapshot: string | null;
  student_full_name_snapshot: string | null;
  academic_year_snapshot: string | null;
  class_code_snapshot: string | null;
  class_title_snapshot: string | null;
  assessment_component_type: "diagnostic" | "frequent" | "periodic" | "final" | null;
  assessment_clo_codes: string[] | null;
  clo_scores: Record<string, unknown> | null;
  raw_score: number | null;
  max_score: number | null;
  normalized_score: number | null;
  status: SubmissionStatus;
  source: SubmissionSource;
  submitted_at: string | null;
  published_at: string | null;
};

type CourseOverviewRow = {
  id: string;
  code: string;
  title: string;
  assessment_components: CourseAssessmentComponent[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function extractCloScores(metadata: Record<string, unknown> | null | undefined): Record<string, number | undefined> {
  const rawValue = metadata?.cloScores;

  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(rawValue).map(([key, value]) => [key, typeof value === "number" ? value : undefined]),
  );
}

function mapPublishedRow(row: PublishedCourseAssessmentResultRowDb): PublishedCourseAssessmentResultRow {
  const cloScores = row.clo_scores && typeof row.clo_scores === "object"
    ? Object.fromEntries(
        Object.entries(row.clo_scores).map(([key, value]) => [key, typeof value === "number" ? value : undefined]),
      )
    : {};

  return {
    id: row.id,
    courseId: row.course_id,
    classId: row.class_id,
    assessmentId: row.assessment_id,
    submissionId: row.submission_id,
    studentId: row.student_id,
    studentIdentifier: row.student_identifier,
    studentCode: row.student_code_snapshot ?? undefined,
    studentFullName: row.student_full_name_snapshot ?? row.student_identifier,
    academicYear: row.academic_year_snapshot ?? undefined,
    classCode: row.class_code_snapshot ?? undefined,
    classTitle: row.class_title_snapshot ?? undefined,
    assessmentComponentType: row.assessment_component_type ?? undefined,
    assessmentCloCodes: row.assessment_clo_codes ?? [],
    cloScores,
    rawScore: row.raw_score ?? undefined,
    maxScore: row.max_score ?? undefined,
    normalizedScore: row.normalized_score ?? undefined,
    status: row.status,
    source: row.source,
    submittedAt: row.submitted_at ?? undefined,
    publishedAt: row.published_at ?? undefined,
  };
}

export async function publishAssessmentResultsToCourseRepository(input: {
  assessmentId: string;
  publishedBy: string;
}): Promise<{ courseId: string; publishedRows: number }> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .select("id,course_id,title,assessment_component_type,assessment_clo_codes,results_locked_at,results_published_at,class:classes(id,class_code,title,academic_year)")
    .eq("id", input.assessmentId)
    .maybeSingle<AssessmentPublicationAssessmentRow>();

  if (assessmentError) {
    throw assessmentError;
  }

  if (!assessment) {
    throw new Error("Không tìm thấy bài kiểm tra để nộp kết quả.");
  }

  if (!assessment.results_locked_at) {
    throw new Error("Bạn cần KHÓA KẾT QUẢ trước khi NỘP KẾT QUẢ.");
  }

  if (assessment.results_published_at) {
    throw new Error("Kết quả bài kiểm tra này đã được nộp cho Mod và không thể hoàn tác.");
  }

  const classRelation = firstRelation(assessment.class);

  if (!classRelation) {
    throw new Error("Không tìm thấy lớp học gắn với bài kiểm tra.");
  }

  const { data: submissions, error: submissionError } = await supabase
    .from("submissions")
    .select("id,student_id,student_identifier,attempt_number,raw_score,max_score,normalized_score,status,source,submitted_at,created_at,metadata")
    .eq("assessment_id", input.assessmentId)
    .order("attempt_number", { ascending: false })
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<SubmissionPublicationRow[]>();

  if (submissionError) {
    throw submissionError;
  }

  const latestSubmissionByStudent = new Map<string, SubmissionPublicationRow>();

  for (const submission of submissions ?? []) {
    if (!latestSubmissionByStudent.has(submission.student_id)) {
      latestSubmissionByStudent.set(submission.student_id, submission);
    }
  }

  const latestSubmissions = Array.from(latestSubmissionByStudent.values());

  const studentIds = Array.from(new Set(latestSubmissions.map((submission) => submission.student_id)));
  const { data: studentProfiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,student_code")
    .in("id", studentIds)
    .returns<StudentProfileRow[]>();

  if (profileError) {
    throw profileError;
  }

  const profileById = new Map((studentProfiles ?? []).map((profile) => [profile.id, profile]));

  const { error: clearError } = await supabase
    .from("course_assessment_results")
    .update({
      published_at: null,
      published_by: null,
    })
    .eq("assessment_id", input.assessmentId);

  if (clearError) {
    throw clearError;
  }

  if (latestSubmissions.length === 0) {
    return {
      courseId: assessment.course_id,
      publishedRows: 0,
    };
  }

  const publishedAt = new Date().toISOString();
  const upsertRows = latestSubmissions.map((submission) => {
    const profile = profileById.get(submission.student_id);

    return {
      course_id: assessment.course_id,
      class_id: classRelation.id,
      assessment_id: input.assessmentId,
      submission_id: submission.id,
      student_id: submission.student_id,
      student_identifier: submission.student_identifier,
      attempt_number: submission.attempt_number,
      raw_score: submission.raw_score,
      max_score: submission.max_score,
      normalized_score: submission.normalized_score,
      status: submission.status,
      source: submission.source,
      submitted_at: submission.submitted_at,
      assessment_component_type: assessment.assessment_component_type,
      assessment_clo_codes: assessment.assessment_clo_codes ?? [],
      clo_scores: extractCloScores(submission.metadata),
      class_code_snapshot: classRelation.class_code,
      class_title_snapshot: classRelation.title,
      academic_year_snapshot: classRelation.academic_year,
      student_code_snapshot: profile?.student_code ?? null,
      student_full_name_snapshot: profile?.full_name ?? submission.student_identifier,
      published_at: publishedAt,
      published_by: input.publishedBy,
    };
  });

  const { error: upsertError } = await supabase
    .from("course_assessment_results")
    .upsert(upsertRows, { onConflict: "submission_id" });

  if (upsertError) {
    throw upsertError;
  }

  const { error: finalizeAssessmentError } = await supabase
    .from("assessments")
    .update({
      results_published_at: publishedAt,
      results_published_by: input.publishedBy,
    })
    .eq("id", input.assessmentId);

  if (finalizeAssessmentError) {
    throw finalizeAssessmentError;
  }

  return {
    courseId: assessment.course_id,
    publishedRows: upsertRows.length,
  };
}

export async function getCourseAssessmentPublicationOverviewRepository(courseId: string): Promise<CourseAssessmentPublicationOverview | null> {
  const supabase = await createServerSupabaseClient();
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id,code,title,assessment_components")
    .eq("id", courseId)
    .maybeSingle<CourseOverviewRow>();

  if (courseError) {
    throw courseError;
  }

  if (!course) {
    return null;
  }

  const { data: rows, error: rowError } = await supabase
    .from("course_assessment_results")
    .select("id,course_id,class_id,assessment_id,submission_id,student_id,student_identifier,student_code_snapshot,student_full_name_snapshot,academic_year_snapshot,class_code_snapshot,class_title_snapshot,assessment_component_type,assessment_clo_codes,clo_scores,raw_score,max_score,normalized_score,status,source,submitted_at,published_at")
    .eq("course_id", courseId)
    .not("published_at", "is", null)
    .order("academic_year_snapshot", { ascending: true, nullsFirst: false })
    .order("class_code_snapshot", { ascending: true, nullsFirst: false })
    .order("student_code_snapshot", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .returns<PublishedCourseAssessmentResultRowDb[]>();

  if (rowError) {
    throw rowError;
  }

  return {
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.title,
    assessmentComponents: (course.assessment_components ?? []).map((component) => ({
      ...component,
      cloCodes: component.cloCodes ?? [],
    })),
    publishedRows: (rows ?? []).map(mapPublishedRow),
  };
}
