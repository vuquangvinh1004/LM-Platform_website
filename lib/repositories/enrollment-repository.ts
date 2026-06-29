import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import type {
  EnrollmentRequest,
  EnrollmentRequestCreateItem,
  EnrollmentRequestSummary,
  EnrollmentRequestStatus,
} from "@/lib/types/enrollment";

export type CreateEnrollmentRequestsRepositoryInput = {
  studentId: string;
  requests: EnrollmentRequestCreateItem[];
};

export type ReviewEnrollmentRequestRepositoryInput = {
  requestId: string;
  actorId: string;
  actorRole: "teacher";
  status: Extract<EnrollmentRequestStatus, "approved" | "rejected">;
  note?: string;
};

type EnrollmentRequestRow = {
  id: string;
  student_id: string;
  course_id: string;
  class_id: string | null;
  status: EnrollmentRequestStatus;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

type EnrollmentRequestSummaryRow = EnrollmentRequestRow & {
  student: {
    full_name: string;
    email: string;
    student_code: string | null;
  } | null;
  course: {
    code: string;
    title: string;
  } | null;
  target_class: {
    class_code: string;
    title: string;
  } | null;
};

type PermissionScopeRow = {
  scope_type: "system" | "course" | "class";
  scope_id: string | null;
  permissions: Record<string, unknown> | null;
  expires_at: string | null;
};

function mapEnrollmentRow(row: EnrollmentRequestRow): EnrollmentRequest {
  return {
    id: row.id,
    studentId: row.student_id,
    courseId: row.course_id,
    classId: row.class_id,
    status: row.status,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
  };
}

function mapEnrollmentSummaryRow(row: EnrollmentRequestSummaryRow): EnrollmentRequestSummary {
  return {
    ...mapEnrollmentRow(row),
    studentFullName: row.student?.full_name ?? null,
    studentEmail: row.student?.email ?? null,
    studentCode: row.student?.student_code ?? null,
    courseCode: row.course?.code ?? null,
    courseTitle: row.course?.title ?? null,
    classCode: row.target_class?.class_code ?? null,
    classTitle: row.target_class?.title ?? null,
  };
}

async function canActorReviewRequest(
  actorId: string,
  actorRole: ReviewEnrollmentRequestRepositoryInput["actorRole"],
  targetClassId: string,
): Promise<boolean> {
  if (actorRole !== "teacher") {
    return false;
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data: targetClass, error: targetClassError } = await supabase
    .from("classes")
    .select("teacher_id,course_id")
    .eq("id", targetClassId)
    .maybeSingle<{ teacher_id: string; course_id: string }>();

  if (targetClassError) {
    throw targetClassError;
  }

  if (!targetClass) {
    return false;
  }

  if (targetClass.teacher_id === actorId) {
    return true;
  }

  const nowIso = new Date().toISOString();
  const { data: scopedPermissions, error: scopedPermissionError } = await supabase
    .from("permission_scopes")
    .select("scope_type,scope_id,permissions,expires_at")
    .eq("actor_id", actorId)
    .eq("status", "active")
    .in("scope_type", ["system", "course", "class"])
    .returns<PermissionScopeRow[]>();

  if (scopedPermissionError) {
    throw scopedPermissionError;
  }

  return (scopedPermissions ?? []).some((scope) => {
    const expiresAt = scope.expires_at ? new Date(scope.expires_at).toISOString() : null;
    const permissions = scope.permissions as Record<string, unknown> | null;
    const canManageClass = permissions?.manage_class === true;

    if (!canManageClass) {
      return false;
    }

    if (expiresAt && expiresAt <= nowIso) {
      return false;
    }

    if (scope.scope_type === "system") {
      return true;
    }

    if (scope.scope_type === "class") {
      return scope.scope_id === targetClassId;
    }

    return scope.scope_id === targetClass.course_id;
  });
}

async function resolveEnrollmentClassId(input: {
  explicitClassId: string | null;
  courseId: string;
}): Promise<string> {
  if (input.explicitClassId) {
    return input.explicitClassId;
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("course_id", input.courseId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(2);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("NO_ACTIVE_CLASS_FOR_COURSE");
  }

  if (data.length > 1) {
    throw new Error("MULTIPLE_ACTIVE_CLASSES_FOR_COURSE");
  }

  return data[0].id;
}

async function activateClassMembership(input: {
  classId: string;
  studentId: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { error } = await supabase.from("class_members").upsert(
    {
      class_id: input.classId,
      student_id: input.studentId,
      status: "active",
      removed_at: null,
    },
    {
      onConflict: "class_id,student_id",
    },
  );

  if (error) {
    throw error;
  }
}

type ClassEnrollmentModeRow = {
  id: string;
  auto_approve_enrollment: boolean;
};

/**
 * Inserts enrollment requests. Duplicate pending requests are ignored by unique index constraints.
 */
export async function createEnrollmentRequestsRepository(
  input: CreateEnrollmentRequestsRepositoryInput,
): Promise<{ created: EnrollmentRequest[]; skipped: EnrollmentRequestCreateItem[]; autoApproved: number }> {
  const supabase = createServiceRoleSupabaseClient();
  const nowIso = new Date().toISOString();
  const classIds = [...new Set(input.requests.map((item) => item.classId).filter(Boolean))] as string[];
  const { data: classRows, error: classError } = classIds.length > 0
    ? await supabase.from("classes").select("id,auto_approve_enrollment").in("id", classIds)
    : { data: [], error: null };

  if (classError) {
    throw classError;
  }

  const autoApproveByClassId = new Map(((classRows ?? []) as ClassEnrollmentModeRow[]).map((row) => [row.id, row.auto_approve_enrollment]));
  const created: EnrollmentRequest[] = [];
  const skipped: EnrollmentRequestCreateItem[] = [];
  let autoApproved = 0;

  for (const item of input.requests) {
    const isAutoApproved = item.classId ? autoApproveByClassId.get(item.classId) === true : false;
    const { data, error } = await supabase
      .from("enrollment_requests")
      .insert({
        student_id: input.studentId,
        course_id: item.courseId,
        class_id: item.classId ?? null,
        status: isAutoApproved ? "approved" : "pending",
        requested_at: nowIso,
        reviewed_at: isAutoApproved ? nowIso : null,
        review_note: isAutoApproved ? "Tự động duyệt theo cấu hình lớp." : null,
      })
      .select("id,student_id,course_id,class_id,status,requested_at,reviewed_by,reviewed_at,review_note")
      .maybeSingle<EnrollmentRequestRow>();

    if (error || !data) {
      skipped.push(item);
      continue;
    }

    if (isAutoApproved && item.classId) {
      await activateClassMembership({
        classId: item.classId,
        studentId: input.studentId,
      });
      autoApproved += 1;
    }

    created.push(mapEnrollmentRow(data));
  }

  return {
    created,
    skipped,
    autoApproved,
  };
}

export async function listEnrollmentRequestsForStudentRepository(studentId: string): Promise<EnrollmentRequestSummary[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("enrollment_requests")
    .select(
      "id,student_id,course_id,class_id,status,requested_at,reviewed_by,reviewed_at,review_note,student:profiles!enrollment_requests_student_id_fkey(full_name,email,student_code),course:courses!enrollment_requests_course_id_fkey(code,title),target_class:classes!enrollment_requests_class_id_fkey(class_code,title)",
    )
    .eq("student_id", studentId)
    .order("requested_at", { ascending: false })
    .limit(20)
    .returns<EnrollmentRequestSummaryRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapEnrollmentSummaryRow);
}

export async function listEnrollmentRequestsByClassIdsRepository(classIds: string[]): Promise<EnrollmentRequestSummary[]> {
  if (classIds.length === 0) {
    return [];
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("enrollment_requests")
    .select(
      "id,student_id,course_id,class_id,status,requested_at,reviewed_by,reviewed_at,review_note,student:profiles!enrollment_requests_student_id_fkey(full_name,email,student_code),course:courses!enrollment_requests_course_id_fkey(code,title),target_class:classes!enrollment_requests_class_id_fkey(class_code,title)",
    )
    .in("class_id", classIds)
    .order("requested_at", { ascending: false })
    .limit(100)
    .returns<EnrollmentRequestSummaryRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapEnrollmentSummaryRow);
}

/**
 * Updates enrollment request review status and reviewer metadata.
 */
export async function reviewEnrollmentRequestRepository(
  input: ReviewEnrollmentRequestRepositoryInput,
): Promise<EnrollmentRequest | null> {
  const supabase = createServiceRoleSupabaseClient();

  const { data: currentRequest, error: currentRequestError } = await supabase
    .from("enrollment_requests")
    .select("id,student_id,course_id,class_id,status,requested_at,reviewed_by,reviewed_at,review_note")
    .eq("id", input.requestId)
    .maybeSingle<EnrollmentRequestRow>();

  if (currentRequestError) {
    throw currentRequestError;
  }

  if (!currentRequest) {
    return null;
  }

  const targetClassId = await resolveEnrollmentClassId({
    explicitClassId: currentRequest.class_id,
    courseId: currentRequest.course_id,
  });

  const canReview = await canActorReviewRequest(input.actorId, input.actorRole, targetClassId);

  if (!canReview) {
    throw new Error("FORBIDDEN_SCOPE_REVIEW");
  }

  if (input.status === "approved") {

    await activateClassMembership({
      classId: targetClassId,
      studentId: currentRequest.student_id,
    });
  }

  const { data, error } = await supabase
    .from("enrollment_requests")
    .update({
      status: input.status,
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      review_note: input.note ?? null,
    })
    .eq("id", input.requestId)
    .select("id,student_id,course_id,class_id,status,requested_at,reviewed_by,reviewed_at,review_note")
    .maybeSingle<EnrollmentRequestRow>();

  if (error) {
    throw error;
  }

  if (data) {
    try {
      await createActivityLogRepository({
        actorId: input.actorId,
        action: input.status === "approved" ? "enrollment.request.approved" : "enrollment.request.rejected",
        entityType: "enrollment_request",
        entityId: data.id,
        metadata: {
          studentId: data.student_id,
          courseId: data.course_id,
          classId: data.class_id,
          note: input.note ?? null,
        },
      });
    } catch {
      // Do not fail review flow due to audit log write errors.
    }
  }

  return data ? mapEnrollmentRow(data) : null;
}
