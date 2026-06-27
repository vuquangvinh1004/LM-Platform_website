import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ClassChangeRequest, CourseClassSummary, ClassMemberSummary } from "@/lib/types/class";

export type ListClassesForUserRepositoryInput = {
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  page: number;
  pageSize: number;
};

export type ListClassesForUserRepositoryResult = {
  items: CourseClassSummary[];
  totalItems: number;
};

export type CreateClassRepositoryInput = {
  courseId: string;
  teacherId: string;
  classCode: string;
  title: string;
  semester?: string;
  academicYear?: string;
  status: "draft" | "active" | "archived";
};

export type FindManageableCourseRepositoryInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type ManageableCourseRecord = {
  id: string;
  ownerId: string;
  title: string;
  status: "draft" | "active" | "archived";
};

export type FindManageableClassRepositoryInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type ManageableClassRecord = {
  id: string;
  courseId: string;
  teacherId: string;
  classCode?: string;
  title: string;
  courseCode?: string;
  courseTitle?: string;
  status: "draft" | "active" | "archived";
};

export type StudentProfileMatch = {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
};

type StudentProfileLookupRow = {
  id: string;
  email: string;
  full_name: string;
  student_code: string | null;
};

type ClassChangeRequestRow = {
  id: string;
  action: "create" | "archive" | "delete";
  target_class_id: string | null;
  course_id: string;
  class_code: string | null;
  title: string | null;
  semester: string | null;
  academic_year: string | null;
  requested_status: "draft" | "active" | "archived" | null;
  status: "pending_review" | "approved" | "rejected";
  reason: string | null;
  review_note: string | null;
  requested_by: string;
  requested_by_profile?: { full_name: string | null } | { full_name: string | null }[] | null;
  reviewed_by: string | null;
  reviewed_by_profile?: { full_name: string | null } | { full_name: string | null }[] | null;
  reviewed_at: string | null;
  created_at: string;
};

type ManageableClassRow = {
  id: string;
  course_id: string;
  teacher_id: string;
  class_code: string;
  title: string;
  status: "draft" | "active" | "archived";
  course: { code: string; title: string } | { code: string; title: string }[] | null;
};

export type ListClassChangeRequestsRepositoryInput = {
  requestedBy?: string;
  courseIds?: string[];
  statuses?: Array<"pending_review" | "approved" | "rejected">;
  actions?: Array<"create" | "archive" | "delete">;
};

export type FindStudentProfilesRepositoryInput = {
  classId: string;
  emails: string[];
  studentCodes: string[];
};

export type CreateClassMembershipsRepositoryInput = Array<{
  classId: string;
  studentId: string;
}>;

export type ListClassMembersRepositoryInput = {
  classId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  page: number;
  pageSize: number;
};

export type ListClassMembersRepositoryResult = {
  items: ClassMemberSummary[];
  totalItems: number;
};

export type ListClassMembersByClassIdsRepositoryInput = {
  classIds: string[];
};

function mapClassRow(row: {
  id: string;
  course_id: string;
  teacher_id: string;
  class_code: string;
  title: string;
  semester: string | null;
  academic_year: string | null;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
  course?: { code: string; title: string } | { code: string; title: string }[] | null;
}): CourseClassSummary {
  const courseRelation = Array.isArray(row.course) ? row.course[0] : row.course;

  return {
    id: row.id,
    courseId: row.course_id,
    teacherId: row.teacher_id,
    courseCode: courseRelation?.code ?? "",
    courseTitle: courseRelation?.title ?? "",
    classCode: row.class_code,
    title: row.title,
    semester: row.semester,
    academicYear: row.academic_year,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClassMemberRow(row: {
  id: string;
  class_id: string;
  student_id: string;
  status: "active" | "inactive" | "removed";
  joined_at: string;
  profile?: { email: string; full_name: string; student_code: string | null } | { email: string; full_name: string; student_code: string | null }[] | null;
}): ClassMemberSummary {
  const profileRelation = Array.isArray(row.profile) ? row.profile[0] : row.profile;

  return {
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    email: profileRelation?.email ?? "",
    fullName: profileRelation?.full_name ?? "",
    studentCode: profileRelation?.student_code ?? null,
    status: row.status,
    joinedAt: row.joined_at,
  };
}

function mapClassChangeRequestRow(row: ClassChangeRequestRow): ClassChangeRequest {
  const requestedByProfile = Array.isArray(row.requested_by_profile) ? row.requested_by_profile[0] : row.requested_by_profile;
  const reviewedByProfile = Array.isArray(row.reviewed_by_profile) ? row.reviewed_by_profile[0] : row.reviewed_by_profile;

  return {
    id: row.id,
    action: row.action,
    targetClassId: row.target_class_id,
    courseId: row.course_id,
    classCode: row.class_code,
    title: row.title,
    semester: row.semester,
    academicYear: row.academic_year,
    requestedStatus: row.requested_status,
    status: row.status,
    reason: row.reason,
    reviewNote: row.review_note,
    requestedBy: row.requested_by,
    requestedByName: requestedByProfile?.full_name ?? null,
    reviewedBy: row.reviewed_by,
    reviewedByName: reviewedByProfile?.full_name ?? null,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

/**
 * Lists classes visible to the actor by role and active membership.
 */
export async function listClassesForUserRepository(
  input: ListClassesForUserRepositoryInput,
): Promise<ListClassesForUserRepositoryResult> {
  const supabase = await createServerSupabaseClient();
  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;

  if (input.actorRole === "teacher" || input.actorRole === "admin" || input.actorRole === "moderator") {
    let query = supabase
      .from("classes")
      .select(
      "id,course_id,teacher_id,class_code,title,semester,academic_year,status,created_at,updated_at,course:courses(code,title)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

    if (input.actorRole === "teacher") {
      query = query.eq("teacher_id", input.actorId);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const classRows = (data ?? []).map(mapClassRow);
    const templateSourceIds = await listTemplateSourceClassIdsRepository();
    const filteredItems = classRows.filter((courseClass) => !templateSourceIds.has(courseClass.id));

    return {
      items: filteredItems,
      totalItems: filteredItems.length,
    };
  }

  const { data, error, count } = await supabase
    .from("class_members")
    .select(
      "id,status,joined_at,class:classes(id,course_id,teacher_id,class_code,title,semester,academic_year,status,created_at,updated_at,course:courses(code,title))",
      { count: "exact" },
    )
    .eq("student_id", input.actorId)
    .eq("status", "active")
    .order("joined_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const items: CourseClassSummary[] = (data ?? [])
    .map((row) => {
      const classRelation = Array.isArray(row.class) ? row.class[0] : row.class;
      return classRelation ? mapClassRow(classRelation) : null;
    })
    .filter((row): row is CourseClassSummary => Boolean(row));

  return {
    items,
    totalItems: count ?? 0,
  };
}

async function listTemplateSourceClassIdsRepository(): Promise<Set<string>> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("class_templates").select("source_class_id");

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("class_templates")) {
      return new Set();
    }

    throw error;
  }

  return new Set((data ?? []).map((row) => row.source_class_id).filter((value): value is string => Boolean(value)));
}

/**
 * Finds a course record that the actor can manage classes for.
 */
export async function findManageableCourseRepository(
  input: FindManageableCourseRepositoryInput,
): Promise<ManageableCourseRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("courses").select("id,owner_id,title,status").eq("id", input.courseId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    ownerId: data.owner_id,
    title: data.title,
    status: data.status,
  };
}

/**
 * Creates a class row under a teacher-owned course.
 */
export async function createClassRepository(input: CreateClassRepositoryInput): Promise<CourseClassSummary> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("classes")
    .insert({
      course_id: input.courseId,
      teacher_id: input.teacherId,
      class_code: input.classCode,
      title: input.title,
      semester: input.semester ?? null,
      academic_year: input.academicYear ?? null,
      status: input.status,
    })
    .select(
      "id,course_id,teacher_id,class_code,title,semester,academic_year,status,created_at,updated_at,course:courses(code,title)",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapClassRow(data);
}

export async function deleteClassRepository(classId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("classes").delete().eq("id", classId);

  if (error) {
    throw error;
  }
}

export async function listClassesByIdsRepository(classIds: string[]): Promise<CourseClassSummary[]> {
  const supabase = createServiceRoleSupabaseClient();

  if (classIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("classes")
    .select("id,course_id,teacher_id,class_code,title,semester,academic_year,status,created_at,updated_at,course:courses(code,title)")
    .in("id", classIds)
    .returns<Array<Parameters<typeof mapClassRow>[0]>>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapClassRow);
}

/**
 * Finds a class record that the actor can manage memberships for.
 */
export async function findManageableClassRepository(
  input: FindManageableClassRepositoryInput,
): Promise<ManageableClassRecord | null> {
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("classes")
    .select("id,course_id,teacher_id,class_code,title,status,course:courses(code,title)")
    .eq("id", input.classId);

  if (input.actorRole === "teacher") {
    query = query.eq("teacher_id", input.actorId);
  }

  const { data, error } = await query.maybeSingle<ManageableClassRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    courseId: data.course_id,
    teacherId: data.teacher_id,
    classCode: data.class_code,
    title: data.title,
    courseCode: Array.isArray(data.course) ? data.course[0]?.code ?? "" : data.course?.code ?? "",
    courseTitle: Array.isArray(data.course) ? data.course[0]?.title ?? "" : data.course?.title ?? "",
    status: data.status,
  };
}

/**
 * Finds existing student profiles by email and/or student code for membership creation.
 */
export async function findStudentProfilesRepository(
  input: FindStudentProfilesRepositoryInput,
): Promise<StudentProfileMatch[]> {
  const supabase = await createServerSupabaseClient();
  const normalizedEmails = input.emails.map((email) => email.trim().toLowerCase()).filter(Boolean);
  const normalizedStudentCodes = input.studentCodes.map((code) => code.trim()).filter(Boolean);

  if (normalizedEmails.length === 0 && normalizedStudentCodes.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("find_student_profiles_for_class_membership", {
    target_class_id: input.classId,
    target_emails: normalizedEmails,
    target_student_codes: normalizedStudentCodes,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as StudentProfileLookupRow[]).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    studentCode: row.student_code,
  }));
}

/**
 * Lists existing active memberships for duplicate detection.
 */
export async function listExistingActiveMembershipStudentIdsRepository(
  classId: string,
  studentIds: string[],
): Promise<Set<string>> {
  const supabase = await createServerSupabaseClient();

  if (studentIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("class_members")
    .select("student_id")
    .eq("class_id", classId)
    .eq("status", "active")
    .in("student_id", studentIds);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.student_id));
}

/**
 * Inserts active class memberships for resolved students.
 */
export async function createClassMembershipsRepository(
  input: CreateClassMembershipsRepositoryInput,
): Promise<number> {
  const supabase = await createServerSupabaseClient();

  if (input.length === 0) {
    return 0;
  }

  const { error } = await supabase.from("class_members").insert(
    input.map((row) => ({
      class_id: row.classId,
      student_id: row.studentId,
      status: "active",
    })),
  );

  if (error) {
    throw error;
  }

  return input.length;
}

/**
 * Lists class members visible to the actor.
 */
export async function listClassMembersRepository(
  input: ListClassMembersRepositoryInput,
): Promise<ListClassMembersRepositoryResult> {
  const supabase = await createServerSupabaseClient();
  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;

  let query = supabase
    .from("class_members")
    .select("id,class_id,student_id,status,joined_at,profile:profiles(email,full_name,student_code)", {
      count: "exact",
    })
    .eq("class_id", input.classId)
    .order("joined_at", { ascending: false })
    .range(from, to);

  if (input.actorRole === "student") {
    query = query.eq("student_id", input.actorId);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    items: (data ?? []).map(mapClassMemberRow),
    totalItems: count ?? 0,
  };
}

export async function listClassMembersByClassIdsRepository(
  input: ListClassMembersByClassIdsRepositoryInput,
): Promise<Record<string, ClassMemberSummary[]>> {
  if (input.classIds.length === 0) {
    return {};
  }

  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("class_members")
    .select("id,class_id,student_id,status,joined_at,profile:profiles(email,full_name,student_code)")
    .in("class_id", input.classIds)
    .order("joined_at", { ascending: false });

  if (error) {
    throw error;
  }

  const grouped = new Map<string, ClassMemberSummary[]>();

  for (const row of (data ?? []) as Array<Parameters<typeof mapClassMemberRow>[0]>) {
    const mapped = mapClassMemberRow(row);
    const existing = grouped.get(mapped.classId) ?? [];
    existing.push(mapped);
    grouped.set(mapped.classId, existing);
  }

  return Object.fromEntries(grouped.entries());
}

export async function listClassChangeRequestsRepository(
  input: ListClassChangeRequestsRepositoryInput = {},
): Promise<ClassChangeRequest[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("class_change_requests")
    .select(
      "id,action,target_class_id,course_id,class_code,title,semester,academic_year,requested_status,status,reason,review_note,requested_by,requested_by_profile:profiles!class_change_requests_requested_by_fkey(full_name),reviewed_by,reviewed_by_profile:profiles!class_change_requests_reviewed_by_fkey(full_name),reviewed_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (input.requestedBy) {
    query = query.eq("requested_by", input.requestedBy);
  }

  if (input.courseIds && input.courseIds.length > 0) {
    query = query.in("course_id", input.courseIds);
  }

  if (input.statuses && input.statuses.length > 0) {
    query = query.in("status", input.statuses);
  }

  if (input.actions && input.actions.length > 0) {
    query = query.in("action", input.actions);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("class_change_requests")) {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as ClassChangeRequestRow[]).map(mapClassChangeRequestRow);
}

export async function createClassCreateRequestRepository(input: CreateClassRepositoryInput & {
  requestedBy: string;
  reason?: string;
}): Promise<ClassChangeRequest> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("class_change_requests")
    .insert({
      action: "create",
      course_id: input.courseId,
      class_code: input.classCode,
      title: input.title,
      semester: input.semester ?? null,
      academic_year: input.academicYear ?? null,
      requested_status: input.status,
      requested_by: input.requestedBy,
      reason: input.reason ?? null,
      status: "pending_review",
    })
    .select(
      "id,action,target_class_id,course_id,class_code,title,semester,academic_year,requested_status,status,reason,review_note,requested_by,requested_by_profile:profiles!class_change_requests_requested_by_fkey(full_name),reviewed_by,reviewed_by_profile:profiles!class_change_requests_reviewed_by_fkey(full_name),reviewed_at,created_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapClassChangeRequestRow(data as ClassChangeRequestRow);
}

export async function createClassLifecycleRequestRepository(input: {
  action: "archive" | "delete";
  classId: string;
  courseId: string;
  requestedBy: string;
  reason?: string;
}): Promise<ClassChangeRequest> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("class_change_requests")
    .insert({
      action: input.action,
      target_class_id: input.classId,
      course_id: input.courseId,
      requested_by: input.requestedBy,
      reason: input.reason ?? null,
      status: "pending_review",
    })
    .select(
      "id,action,target_class_id,course_id,class_code,title,semester,academic_year,requested_status,status,reason,review_note,requested_by,requested_by_profile:profiles!class_change_requests_requested_by_fkey(full_name),reviewed_by,reviewed_by_profile:profiles!class_change_requests_reviewed_by_fkey(full_name),reviewed_at,created_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return mapClassChangeRequestRow(data as ClassChangeRequestRow);
}

export async function getClassChangeRequestByIdRepository(requestId: string): Promise<ClassChangeRequest | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("class_change_requests")
    .select(
      "id,action,target_class_id,course_id,class_code,title,semester,academic_year,requested_status,status,reason,review_note,requested_by,requested_by_profile:profiles!class_change_requests_requested_by_fkey(full_name),reviewed_by,reviewed_by_profile:profiles!class_change_requests_reviewed_by_fkey(full_name),reviewed_at,created_at",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapClassChangeRequestRow(data as ClassChangeRequestRow) : null;
}

export async function reviewClassChangeRequestRepository(input: {
  requestId: string;
  reviewedBy: string;
  status: "approved" | "rejected";
  reviewNote?: string;
}): Promise<ClassChangeRequest | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("class_change_requests")
    .update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
    })
    .eq("id", input.requestId)
    .select(
      "id,action,target_class_id,course_id,class_code,title,semester,academic_year,requested_status,status,reason,review_note,requested_by,requested_by_profile:profiles!class_change_requests_requested_by_fkey(full_name),reviewed_by,reviewed_by_profile:profiles!class_change_requests_reviewed_by_fkey(full_name),reviewed_at,created_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapClassChangeRequestRow(data as ClassChangeRequestRow) : null;
}

export async function applyApprovedClassChangeRequestRepository(request: ClassChangeRequest): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  if (request.action === "create") {
    const { error } = await supabase.from("classes").insert({
      course_id: request.courseId,
      teacher_id: request.requestedBy,
      class_code: request.classCode,
      title: request.title,
      semester: request.semester,
      academic_year: request.academicYear,
      status: request.requestedStatus ?? "active",
    });

    if (error) {
      throw error;
    }

    return;
  }

  if (!request.targetClassId) {
    throw new Error("CLASS_REQUEST_TARGET_MISSING");
  }

  if (request.action === "archive") {
    const { error } = await supabase.from("classes").update({ status: "archived" }).eq("id", request.targetClassId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("classes").delete().eq("id", request.targetClassId);

  if (error) {
    throw error;
  }
}
