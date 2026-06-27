import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { Paginated } from "@/lib/types/pagination";
import type {
  AssessmentResultsSortDirection,
  AssessmentResultsSortField,
  ImportJobStatus,
  SubmissionSource,
  SubmissionStatus,
  SubmissionSummary,
} from "@/lib/types/submission";

type ManageableAssessmentRow = {
  id: string;
  class_id: string;
  course_id: string;
  title: string;
};

type StudentProfileRow = {
  id: string;
  email: string | null;
  student_code: string | null;
  full_name: string;
};

type ImportJobRow = {
  id: string;
};

type SubmissionRow = {
  id: string;
};

type SubmissionSummaryRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  student_identifier: string;
  raw_score: number | null;
  max_score: number | null;
  normalized_score: number | null;
  submitted_at: string | null;
  status: SubmissionStatus;
  source: SubmissionSource;
  attempt_number: number;
  external_response_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

type AssessmentLifecycleAssessmentRow = {
  id: string;
  class_id: string;
  course_id: string;
  title: string;
  delivery_mode: "external" | "internal";
  due_at: string | null;
  max_score: number | null;
};

type AssessmentLifecycleRosterRow = {
  student_id: string;
  status: "active" | "inactive" | "removed";
  profile: {
    full_name: string;
    email: string | null;
    student_code: string | null;
  } | {
    full_name: string;
    email: string | null;
    student_code: string | null;
  }[] | null;
};

type SubmissionImportRosterRow = {
  student_id: string;
  profile: {
    full_name: string;
    email: string | null;
    student_code: string | null;
  } | {
    full_name: string;
    email: string | null;
    student_code: string | null;
  }[] | null;
};

function firstProfile(
  profile: AssessmentLifecycleRosterRow["profile"],
): { full_name: string; email: string | null; student_code: string | null } | null {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile ?? null;
}

function mapSubmissionSummary(row: SubmissionSummaryRow, profile?: StudentProfileRow): SubmissionSummary {
  const metadata = row.metadata ?? {};
  const sourceLabel = typeof metadata.sourceLabel === "string"
    ? metadata.sourceLabel
    : typeof metadata.importedSourceLabel === "string"
      ? metadata.importedSourceLabel
      : undefined;
  const note = typeof metadata.note === "string"
    ? metadata.note
    : typeof metadata.importNote === "string"
      ? metadata.importNote
      : undefined;

  return {
    id: row.id,
    assessmentId: row.assessment_id,
    studentId: row.student_id,
    studentIdentifier: row.student_identifier,
    studentFullName: profile?.full_name ?? row.student_identifier,
    studentEmail: profile?.email ?? undefined,
    studentCode: profile?.student_code ?? undefined,
    rawScore: row.raw_score ?? undefined,
    maxScore: row.max_score ?? undefined,
    normalizedScore: row.normalized_score ?? undefined,
    submittedAt: row.submitted_at ?? undefined,
    status: row.status,
    source: row.source,
    sourceLabel,
    attemptNumber: row.attempt_number,
    externalResponseId: row.external_response_id ?? undefined,
    note,
    createdAt: row.created_at,
  };
}

/**
 * Loads one assessment if the current actor can manage it under RLS scope.
 */
export async function findManageableAssessmentRepository(input: {
  assessmentId: string;
}): Promise<{ id: string; classId: string; courseId: string; title: string } | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("assessments")
    .select("id,class_id,course_id,title")
    .eq("id", input.assessmentId)
    .maybeSingle<ManageableAssessmentRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    classId: data.class_id,
    courseId: data.course_id,
    title: data.title,
  };
}

/**
 * Creates an import job record for CSV submission ingestion.
 */
export async function createImportJobRepository(input: {
  assessmentId: string;
  actorId: string;
  totalRows: number;
}): Promise<{ id: string }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("import_jobs")
    .insert({
      assessment_id: input.assessmentId,
      created_by: input.actorId,
      source: "csv",
      status: "pending",
      total_rows: input.totalRows,
      success_rows: 0,
      error_rows: 0,
      error_report: [],
    })
    .select("id")
    .single<ImportJobRow>();

  if (error) {
    throw error;
  }

  return { id: data.id };
}

/**
 * Finalizes one import job with row-level summary.
 */
export async function completeImportJobRepository(input: {
  importJobId: string;
  status: ImportJobStatus;
  successRows: number;
  errorRows: number;
  errorReport: Array<{ row: number; reason: string; email?: string; studentCode?: string; fullName?: string }>;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase
    .from("import_jobs")
    .update({
      status: input.status,
      success_rows: input.successRows,
      error_rows: input.errorRows,
      error_report: input.errorReport,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.importJobId);

  if (error) {
    throw error;
  }
}

/**
 * Finds student profiles by email and student code to map CSV rows.
 */
export async function findStudentsForSubmissionImportRepository(input: {
  classId: string;
  emails: string[];
  studentCodes: string[];
}): Promise<Array<{ id: string; email?: string; studentCode?: string; fullName: string }>> {
  const supabase = createServiceRoleSupabaseClient();
  const normalizedEmails = new Set(input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean));
  const normalizedStudentCodes = new Set(input.studentCodes.map((code) => code.trim().toLowerCase()).filter(Boolean));

  const { data, error } = await supabase
    .from("class_members")
    .select("student_id,profile:profiles!class_members_student_id_fkey(full_name,email,student_code)")
    .eq("class_id", input.classId)
    .eq("status", "active")
    .returns<SubmissionImportRosterRow[]>();

  if (error) {
    throw error;
  }

  const matches: Array<{ id: string; email?: string; studentCode?: string; fullName: string }> = [];

  for (const row of data ?? []) {
    const profile = firstProfile(row.profile);
    if (!profile) {
      continue;
    }

    const normalizedEmail = profile.email?.trim().toLowerCase();
    const normalizedStudentCode = profile.student_code?.trim().toLowerCase();
    const hasMatch = Boolean(
      (normalizedEmail && normalizedEmails.has(normalizedEmail))
      || (normalizedStudentCode && normalizedStudentCodes.has(normalizedStudentCode)),
    );

    if (!hasMatch) {
      continue;
    }

    matches.push({
      id: row.student_id,
      email: profile.email ?? undefined,
      studentCode: profile.student_code ?? undefined,
      fullName: profile.full_name,
    });
  }

  return matches;
}

/**
 * Idempotently upserts one submission row by assessment + student identifier + attempt.
 */
export async function upsertSubmissionRepository(input: {
  assessmentId: string;
  studentId: string;
  studentIdentifier: string;
  attemptNumber: number;
  rawScore?: number;
  maxScore?: number;
  normalizedScore?: number;
  submittedAt?: string;
  status: SubmissionStatus;
  source: SubmissionSource;
  importJobId?: string;
  externalResponseId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submissions")
    .upsert(
      {
        assessment_id: input.assessmentId,
        student_id: input.studentId,
        student_identifier: input.studentIdentifier,
        attempt_number: input.attemptNumber,
        raw_score: input.rawScore ?? null,
        max_score: input.maxScore ?? null,
        normalized_score: input.normalizedScore ?? null,
        submitted_at: input.submittedAt ?? null,
        status: input.status,
        source: input.source,
        import_job_id: input.importJobId ?? null,
        external_response_id: input.externalResponseId ?? null,
        metadata: input.metadata ?? {},
      },
      {
        onConflict: "assessment_id,student_identifier,attempt_number",
      },
    )
    .select("id")
    .single<SubmissionRow>();

  if (error) {
    throw error;
  }

  return { id: data.id };
}

/**
 * Upserts one external webhook submission using service role access.
 */
export async function upsertExternalSubmissionServiceRepository(input: {
  assessmentId: string;
  studentId: string;
  studentIdentifier: string;
  attemptNumber: number;
  rawScore?: number;
  maxScore?: number;
  normalizedScore?: number;
  submittedAt?: string;
  source: "google_webhook" | "microsoft_webhook";
  externalResponseId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const supabase = createServiceRoleSupabaseClient();

  const insertPayload = {
    assessment_id: input.assessmentId,
    student_id: input.studentId,
    student_identifier: input.studentIdentifier,
    attempt_number: input.attemptNumber,
    raw_score: input.rawScore ?? null,
    max_score: input.maxScore ?? null,
    normalized_score: input.normalizedScore ?? null,
    submitted_at: input.submittedAt ?? null,
    status: "submitted" as const,
    source: input.source,
    import_job_id: null,
    external_response_id: input.externalResponseId ?? null,
    metadata: input.metadata ?? {},
  };

  if (input.externalResponseId) {
    const { data: existingByExternal, error: existingByExternalError } = await supabase
      .from("submissions")
      .select("id")
      .eq("assessment_id", input.assessmentId)
      .eq("external_response_id", input.externalResponseId)
      .maybeSingle<SubmissionRow>();

    if (existingByExternalError) {
      throw existingByExternalError;
    }

    if (existingByExternal) {
      const { data: updatedByExternal, error: updateByExternalError } = await supabase
        .from("submissions")
        .update(insertPayload)
        .eq("id", existingByExternal.id)
        .select("id")
        .single<SubmissionRow>();

      if (updateByExternalError) {
        throw updateByExternalError;
      }

      return { id: updatedByExternal.id };
    }
  }

  const { data, error } = await supabase
    .from("submissions")
    .upsert(insertPayload, { onConflict: "assessment_id,student_identifier,attempt_number" })
    .select("id")
    .single<SubmissionRow>();

  if (error) {
    throw error;
  }

  return { id: data.id };
}

/**
 * Loads assessment by id using service role for webhook pipeline.
 */
export async function findAssessmentByIdServiceRepository(input: {
  assessmentId: string;
}): Promise<{ id: string; classId: string; courseId: string; title: string } | null> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("assessments")
    .select("id,class_id,course_id,title")
    .eq("id", input.assessmentId)
    .maybeSingle<ManageableAssessmentRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    classId: data.class_id,
    courseId: data.course_id,
    title: data.title,
  };
}

/**
 * Resolves one student using email/student code for webhook ingestion.
 */
export async function findStudentForExternalSubmissionServiceRepository(input: {
  studentEmail?: string;
  studentCode?: string;
}): Promise<{ id: string; email?: string; studentCode?: string; fullName: string } | null> {
  const supabase = createServiceRoleSupabaseClient();

  if (input.studentCode) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,student_code,full_name")
      .eq("role", "student")
      .eq("student_code", input.studentCode)
      .maybeSingle<StudentProfileRow>();

    if (error) {
      throw error;
    }

    if (data) {
      return {
        id: data.id,
        email: data.email ?? undefined,
        studentCode: data.student_code ?? undefined,
        fullName: data.full_name,
      };
    }
  }

  if (input.studentEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,student_code,full_name")
      .eq("role", "student")
      .eq("email", input.studentEmail.toLowerCase())
      .maybeSingle<StudentProfileRow>();

    if (error) {
      throw error;
    }

    if (data) {
      return {
        id: data.id,
        email: data.email ?? undefined,
        studentCode: data.student_code ?? undefined,
        fullName: data.full_name,
      };
    }
  }

  return null;
}

/**
 * Lists submissions for one manageable assessment (RLS-scoped).
 */
export async function listAssessmentResultsRepository(input: {
  assessmentId: string;
  page: number;
  pageSize: number;
  status?: SubmissionStatus;
  sortBy?: AssessmentResultsSortField;
  sortDirection?: AssessmentResultsSortDirection;
}): Promise<Paginated<SubmissionSummary>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("submissions")
    .select("id,assessment_id,student_id,student_identifier,raw_score,max_score,normalized_score,submitted_at,status,source,attempt_number,external_response_id,created_at,metadata")
    .eq("assessment_id", input.assessmentId)
    .order("attempt_number", { ascending: false })
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .returns<SubmissionSummaryRow[]>();

  if (error) {
    throw error;
  }

  const latestRowByStudent = new Map<string, SubmissionSummaryRow>();

  for (const row of data ?? []) {
    if (!latestRowByStudent.has(row.student_id)) {
      latestRowByStudent.set(row.student_id, row);
    }
  }

  const rows = Array.from(latestRowByStudent.values())
    .filter((row) => !input.status || row.status === input.status)
    .sort((left, right) => {
      const leftTime = left.submitted_at ?? left.created_at;
      const rightTime = right.submitted_at ?? right.created_at;
      return new Date(rightTime).getTime() - new Date(leftTime).getTime();
    });

  const studentIds = Array.from(new Set(rows.map((row) => row.student_id)));
  const profiles = await findStudentProfilesByIdsServiceRepository({ studentIds });
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const mappedRows = rows.map((row) => mapSubmissionSummary(row, profileById.get(row.student_id)));

  const sortBy = input.sortBy ?? "submittedAt";
  const sortDirection = input.sortDirection ?? "desc";
  const directionFactor = sortDirection === "asc" ? 1 : -1;

  mappedRows.sort((left, right) => {
    const compareText = (leftValue?: string, rightValue?: string) =>
      (leftValue ?? "").localeCompare(rightValue ?? "", "vi", { sensitivity: "base" });
    const compareNumber = (leftValue?: number, rightValue?: number) =>
      (leftValue ?? Number.NEGATIVE_INFINITY) - (rightValue ?? Number.NEGATIVE_INFINITY);
    const compareDate = (leftValue?: string, rightValue?: string) =>
      new Date(leftValue ?? 0).getTime() - new Date(rightValue ?? 0).getTime();

    let comparison = 0;

    switch (sortBy) {
      case "studentCode":
        comparison = compareText(left.studentCode, right.studentCode);
        break;
      case "studentFullName":
        comparison = compareText(left.studentFullName, right.studentFullName);
        break;
      case "studentEmail":
        comparison = compareText(left.studentEmail, right.studentEmail);
        break;
      case "rawScore":
        comparison = compareNumber(left.rawScore, right.rawScore);
        break;
      case "submittedAt":
        comparison = compareDate(left.submittedAt ?? left.createdAt, right.submittedAt ?? right.createdAt);
        break;
      case "sourceLabel":
        comparison = compareText(left.sourceLabel ?? left.source, right.sourceLabel ?? right.source);
        break;
      case "note":
        comparison = compareText(left.note, right.note);
        break;
      default:
        comparison = compareDate(left.submittedAt ?? left.createdAt, right.submittedAt ?? right.createdAt);
        break;
    }

    if (comparison !== 0) {
      return comparison * directionFactor;
    }

    return compareDate(left.createdAt, right.createdAt) * -1;
  });

  const totalItems = mappedRows.length;
  const from = (input.page - 1) * input.pageSize;
  const items = mappedRows.slice(from, from + input.pageSize);
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize);

  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    totalItems,
    totalPages,
  };
}

/**
 * Reads student profiles by ids using service role for result enrichment.
 */
export async function findStudentProfilesByIdsServiceRepository(input: {
  studentIds: string[];
}): Promise<StudentProfileRow[]> {
  if (input.studentIds.length === 0) {
    return [];
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,student_code,full_name")
    .in("id", input.studentIds)
    .returns<StudentProfileRow[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getAssessmentResultLifecycleContextRepository(input: {
  assessmentId: string;
}): Promise<{
  assessment: {
    id: string;
    classId: string;
    courseId: string;
    title: string;
    deliveryMode: "external" | "internal";
    dueAt?: string;
    maxScore?: number;
  };
  roster: Array<{
    studentId: string;
    studentIdentifier: string;
    studentFullName: string;
    studentEmail?: string;
    studentCode?: string;
  }>;
  submissions: Array<{
    id: string;
    assessmentId: string;
    studentId: string;
    studentIdentifier: string;
    rawScore?: number;
    maxScore?: number;
    normalizedScore?: number;
    submittedAt?: string;
    status: SubmissionStatus;
    source: SubmissionSource;
    attemptNumber: number;
    externalResponseId?: string;
    createdAt: string;
    metadata: Record<string, unknown>;
  }>;
} | null> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: assessment, error: assessmentError } = await supabase
    .from("assessments")
    .select("id,class_id,course_id,title,delivery_mode,due_at,max_score")
    .eq("id", input.assessmentId)
    .maybeSingle<AssessmentLifecycleAssessmentRow>();

  if (assessmentError) {
    throw assessmentError;
  }

  if (!assessment) {
    return null;
  }

  const [{ data: rosterRows, error: rosterError }, { data: submissionRows, error: submissionError }] = await Promise.all([
    supabase
      .from("class_members")
      .select("student_id,status,profile:profiles!class_members_student_id_fkey(full_name,email,student_code)")
      .eq("class_id", assessment.class_id)
      .eq("status", "active")
      .returns<AssessmentLifecycleRosterRow[]>(),
    supabase
      .from("submissions")
      .select("id,assessment_id,student_id,student_identifier,raw_score,max_score,normalized_score,submitted_at,status,source,attempt_number,external_response_id,created_at,metadata")
      .eq("assessment_id", input.assessmentId)
      .order("attempt_number", { ascending: false })
      .order("submitted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .returns<SubmissionSummaryRow[]>(),
  ]);

  if (rosterError) {
    throw rosterError;
  }

  if (submissionError) {
    throw submissionError;
  }

  return {
    assessment: {
      id: assessment.id,
      classId: assessment.class_id,
      courseId: assessment.course_id,
      title: assessment.title,
      deliveryMode: assessment.delivery_mode,
      dueAt: assessment.due_at ?? undefined,
      maxScore: assessment.max_score ?? undefined,
    },
    roster: (rosterRows ?? []).map((row) => {
      const profile = firstProfile(row.profile);
      const studentEmail = profile?.email ?? undefined;
      const studentCode = profile?.student_code ?? undefined;
      const studentFullName = profile?.full_name ?? row.student_id;
      const studentIdentifier = studentCode || studentEmail || studentFullName;

      return {
        studentId: row.student_id,
        studentIdentifier,
        studentFullName,
        studentEmail,
        studentCode,
      };
    }),
    submissions: (submissionRows ?? []).map((row) => ({
      id: row.id,
      assessmentId: row.assessment_id,
      studentId: row.student_id,
      studentIdentifier: row.student_identifier,
      rawScore: row.raw_score ?? undefined,
      maxScore: row.max_score ?? undefined,
      normalizedScore: row.normalized_score ?? undefined,
      submittedAt: row.submitted_at ?? undefined,
      status: row.status,
      source: row.source,
      attemptNumber: row.attempt_number,
      externalResponseId: row.external_response_id ?? undefined,
      createdAt: row.created_at,
      metadata: row.metadata ?? {},
    })),
  };
}
