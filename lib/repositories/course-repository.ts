import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type {
  CourseAssessmentComponent,
  CourseChangeRequest,
  CourseCloItem,
  CourseModeratorOption,
  CourseSummary,
  CourseTeacherAssignment,
  CourseTeacherOption,
} from "@/lib/types/course";
import { GREEK_SYMBOLS } from "@/lib/utils/greek-symbols";

export type ListCoursesRepositoryInput = {
  userId: string;
  role: "admin" | "moderator" | "teacher" | "student";
  query?: string;
  status?: "draft" | "active" | "archived";
  page: number;
  pageSize: number;
};

export type ListCoursesRepositoryResult = {
  items: CourseSummary[];
  totalItems: number;
};

export type CreateCourseRepositoryInput = {
  ownerId: string;
  code: string;
  title: string;
  description?: string;
  visibility: "private" | "unlisted" | "public_preview";
  status: "draft" | "active" | "archived";
  credits?: number;
  knowledgeBlock?: "general" | "foundation" | "major";
  courseType?: "required" | "elective";
  cloItems: CourseCloItem[];
  assessmentComponents: CourseAssessmentComponent[];
};

export type UpdateCourseRepositoryInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  title: string;
  description?: string;
  visibility: "private" | "unlisted" | "public_preview";
  status: "draft" | "active" | "archived";
  credits?: number;
  knowledgeBlock?: "general" | "foundation" | "major";
  courseType?: "required" | "elective";
  cloItems: CourseCloItem[];
  assessmentComponents: CourseAssessmentComponent[];
};

export type ArchiveCourseRepositoryInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type DeleteCourseRepositoryInput = {
  courseId: string;
};

export type CourseDeletionBlockers = {
  classCount: number;
  materialCount: number;
};

export type AssignCourseModeratorRepositoryInput = {
  courseId: string;
  moderatorId: string | null;
  grantedBy: string;
  ownerId: string;
};

export type AssignCourseTeachersRepositoryInput = {
  courseId: string;
  teacherIds: string[];
  grantedBy: string;
};

type CourseRow = {
  id: string;
  owner_id: string;
  owner_profile?: { full_name: string | null; role: "admin" | "moderator" | "teacher" | "student" } | { full_name: string | null; role: "admin" | "moderator" | "teacher" | "student" }[] | null;
  code: string;
  title: string;
  description: string | null;
  visibility: "private" | "unlisted" | "public_preview";
  status: "draft" | "active" | "archived";
  credits: number | null;
  knowledge_block: "general" | "foundation" | "major" | null;
  course_type: "required" | "elective" | null;
  clo_items: CourseCloItem[] | null;
  assessment_components: CourseAssessmentComponent[] | null;
  created_at: string;
  updated_at: string;
};

type CourseChangeRequestRow = {
  id: string;
  action: "create" | "update" | "archive" | "delete";
  target_course_id: string | null;
  target_code_snapshot: string | null;
  target_title_snapshot: string | null;
  requested_code: string | null;
  requested_title: string | null;
  requested_description: string | null;
  requested_visibility: "private" | "unlisted" | "public_preview" | null;
  requested_status: "draft" | "active" | "archived" | null;
  requested_credits: number | null;
  requested_knowledge_block: "general" | "foundation" | "major" | null;
  requested_course_type: "required" | "elective" | null;
  requested_clo_items: CourseCloItem[] | null;
  requested_assessment_components: CourseAssessmentComponent[] | null;
  assigned_moderator_id: string | null;
  status: "pending_review" | "approved" | "rejected";
  reason: string | null;
  review_note: string | null;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type ModeratorProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TeacherProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type PermissionScopeTeacherRow = {
  actor_id: string;
  scope_id: string | null;
  actor_profile?: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: "admin" | "moderator" | "teacher" | "student";
  } | {
    id: string;
    full_name: string | null;
    email: string | null;
    role: "admin" | "moderator" | "teacher" | "student";
  }[] | null;
};

type PermissionScopeCourseIdRow = {
  scope_id: string | null;
};

const COURSE_SELECT =
  "id,owner_id,owner_profile:profiles!courses_owner_id_fkey(full_name,role),code,title,description,visibility,status,credits,knowledge_block,course_type,clo_items,assessment_components,created_at,updated_at";

const COURSE_CHANGE_REQUEST_SELECT =
  "id,action,target_course_id,target_code_snapshot,target_title_snapshot,requested_code,requested_title,requested_description,requested_visibility,requested_status,requested_credits,requested_knowledge_block,requested_course_type,requested_clo_items,requested_assessment_components,assigned_moderator_id,status,reason,review_note,requested_by,reviewed_by,reviewed_at,created_at";

const DEFAULT_SIMULATION_WIDGETS = [
  {
    slug: "moving-average-basic",
    title: "Mô phỏng bình quân di động",
    description: "Widget mô phỏng tính bình quân di động với kích thước cửa sổ có thể điều chỉnh.",
    sortOrder: 10,
  },
  {
    slug: "simple-exponential-smoothing",
    title: "Mô phỏng san bằng mũ đơn giản",
    description: `Widget mô phỏng hệ số ${GREEK_SYMBOLS.alpha} và dự báo theo chuỗi thời gian cơ bản.`,
    sortOrder: 20,
  },
  {
    slug: "normal-distribution-linear-regression",
    title: "Mô phỏng phân phối chuẩn và hồi quy",
    description: "Widget minh họa xác suất cơ bản và đường hồi quy từ tập điểm mẫu.",
    sortOrder: 30,
  },
] as const;

function mapCourseRow(row: CourseRow): CourseSummary {
  const ownerProfile = Array.isArray(row.owner_profile) ? row.owner_profile[0] ?? null : row.owner_profile ?? null;
  const assessmentComponents = (row.assessment_components ?? []).map((component) => ({
    ...component,
    cloCodes: component.cloCodes ?? [],
  }));

  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerFullName: ownerProfile?.full_name ?? null,
    ownerRole: ownerProfile?.role ?? null,
    code: row.code,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    status: row.status,
    credits: row.credits,
    knowledgeBlock: row.knowledge_block,
    courseType: row.course_type,
    cloItems: row.clo_items ?? [],
    assessmentComponents,
    assignedTeachers: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCourseChangeRequestRow(row: CourseChangeRequestRow): CourseChangeRequest {
  const requestedAssessmentComponents = (row.requested_assessment_components ?? []).map((component) => ({
    ...component,
    cloCodes: component.cloCodes ?? [],
  }));

  return {
    id: row.id,
    action: row.action,
    targetCourseId: row.target_course_id,
    targetCodeSnapshot: row.target_code_snapshot ?? row.requested_code ?? "",
    targetTitleSnapshot: row.target_title_snapshot ?? row.requested_title ?? "",
    requestedCode: row.requested_code,
    requestedTitle: row.requested_title,
    requestedDescription: row.requested_description,
    requestedVisibility: row.requested_visibility,
    requestedStatus: row.requested_status,
    requestedCredits: row.requested_credits,
    requestedKnowledgeBlock: row.requested_knowledge_block,
    requestedCourseType: row.requested_course_type,
    requestedCloItems: row.requested_clo_items ?? [],
    requestedAssessmentComponents,
    assignedModeratorId: row.assigned_moderator_id,
    status: row.status,
    reason: row.reason,
    reviewNote: row.review_note,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

function mapModeratorProfileRow(row: ModeratorProfileRow): CourseModeratorOption {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
  };
}

function mapTeacherProfileRow(row: TeacherProfileRow): CourseTeacherOption {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
  };
}

function mapAssignedTeacherScopeRow(row: PermissionScopeTeacherRow): CourseTeacherAssignment | null {
  const actorProfile = Array.isArray(row.actor_profile) ? row.actor_profile[0] ?? null : row.actor_profile ?? null;

  if (!row.scope_id || !actorProfile || actorProfile.role !== "teacher") {
    return null;
  }

  return {
    id: actorProfile.id,
    fullName: actorProfile.full_name,
    email: actorProfile.email,
  };
}

async function attachAssignedTeachersToCourses(courses: CourseSummary[]): Promise<CourseSummary[]> {
  if (courses.length === 0) {
    return courses;
  }

  const supabase = createServiceRoleSupabaseClient();
  const courseIds = courses.map((course) => course.id);
  const { data, error } = await supabase
    .from("permission_scopes")
    .select("actor_id,scope_id,actor_profile:profiles!permission_scopes_actor_id_fkey(id,full_name,email,role)")
    .eq("scope_type", "course")
    .eq("status", "active")
    .in("scope_id", courseIds);

  if (error) {
    throw error;
  }

  const teachersByCourseId = new Map<string, CourseTeacherAssignment[]>();

  for (const row of (data ?? []) as PermissionScopeTeacherRow[]) {
    const assignment = mapAssignedTeacherScopeRow(row);

    if (!assignment || !row.scope_id) {
      continue;
    }

    const existingAssignments = teachersByCourseId.get(row.scope_id) ?? [];
    existingAssignments.push(assignment);
    teachersByCourseId.set(row.scope_id, existingAssignments);
  }

  return courses.map((course) => ({
    ...course,
    assignedTeachers: (teachersByCourseId.get(course.id) ?? []).sort((left, right) =>
      (left.fullName ?? left.email ?? left.id).localeCompare(right.fullName ?? right.email ?? right.id, "vi"),
    ),
  }));
}

/**
 * Reads course rows with filtering and pagination. Business rules stay in service layer.
 */
export async function listCoursesForUserRepository(
  input: ListCoursesRepositoryInput,
): Promise<ListCoursesRepositoryResult> {
  const supabase = await createServerSupabaseClient();
  const from = (input.page - 1) * input.pageSize;
  const to = from + input.pageSize - 1;

  let query = supabase
    .from("courses")
    .select(COURSE_SELECT, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (input.status) {
    query = query.eq("status", input.status);
  }

  if (input.query) {
    const keyword = `%${input.query}%`;
    query = query.or(`code.ilike.${keyword},title.ilike.${keyword}`);
  }

  if (input.role === "moderator") {
    query = query.eq("owner_id", input.userId);
  }

  if (input.role === "teacher") {
    const { data: scopeRows, error: scopeError } = await supabase
      .from("permission_scopes")
      .select("scope_id")
      .eq("actor_id", input.userId)
      .eq("scope_type", "course")
      .eq("status", "active");

    if (scopeError) {
      throw scopeError;
    }

    const visibleCourseIds = [...new Set(((scopeRows ?? []) as PermissionScopeCourseIdRow[]).map((row) => row.scope_id).filter(Boolean))];

    if (visibleCourseIds.length === 0) {
      return {
        items: [],
        totalItems: 0,
      };
    }

    query = query.in("id", visibleCourseIds);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const items = await attachAssignedTeachersToCourses(((data ?? []) as CourseRow[]).map(mapCourseRow));

  return {
    items,
    totalItems: count ?? 0,
  };
}

/**
 * Creates a course row and returns normalized course summary shape.
 */
export async function createCourseRepository(input: CreateCourseRepositoryInput): Promise<CourseSummary> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("courses")
    .insert({
      owner_id: input.ownerId,
      code: input.code,
      title: input.title,
      description: input.description ?? null,
      visibility: input.visibility,
      status: input.status,
      credits: input.credits ?? null,
      knowledge_block: input.knowledgeBlock ?? null,
      course_type: input.courseType ?? null,
      clo_items: input.cloItems,
      assessment_components: input.assessmentComponents,
    })
    .select(COURSE_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCourseRow(data as CourseRow);
}

/**
 * Seeds built-in simulation widgets for a new course. Safe to run repeatedly.
 */
export async function seedDefaultSimulationWidgetsForCourseRepository(courseId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("simulations").upsert(
    DEFAULT_SIMULATION_WIDGETS.map((widget) => ({
      course_id: courseId,
      slug: widget.slug,
      title: widget.title,
      description: widget.description,
      config: { source: "native_widget" },
      sort_order: widget.sortOrder,
      status: "published",
    })),
    { onConflict: "course_id,slug" },
  );

  if (error) {
    const missingTable = error.code === "PGRST205" || error.code === "42P01" || error.message.includes("public.simulations");

    if (missingTable) {
      return;
    }

    throw error;
  }
}

/**
 * Updates a course if actor is allowed by role and ownership constraints.
 */
export async function updateCourseRepository(input: UpdateCourseRepositoryInput): Promise<CourseSummary | null> {
  const supabase = await createServerSupabaseClient();

  let updateQuery = supabase
    .from("courses")
    .update({
      title: input.title,
      description: input.description ?? null,
      visibility: input.visibility,
      status: input.status,
      credits: input.credits ?? null,
      knowledge_block: input.knowledgeBlock ?? null,
      course_type: input.courseType ?? null,
      clo_items: input.cloItems,
      assessment_components: input.assessmentComponents,
    })
    .eq("id", input.courseId);

  if (input.actorRole === "teacher") {
    updateQuery = updateQuery.eq("owner_id", input.actorId);
  }

  const { data, error } = await updateQuery.select(COURSE_SELECT).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCourseRow(data as CourseRow) : null;
}

/**
 * Sets a course status to archived for authorized actors.
 */
export async function archiveCourseRepository(input: ArchiveCourseRepositoryInput): Promise<boolean> {
  const supabase = await createServerSupabaseClient();

  let updateQuery = supabase
    .from("courses")
    .update({
      status: "archived",
    })
    .eq("id", input.courseId);

  if (input.actorRole === "teacher") {
    updateQuery = updateQuery.eq("owner_id", input.actorId);
  }

  const { data, error } = await updateQuery.select("id").maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

/**
 * Hard-deletes a course and dependent rows through FK cascade. Admin-only at service layer.
 */
export async function deleteCourseRepository(input: DeleteCourseRepositoryInput): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase.from("courses").delete().eq("id", input.courseId).select("id").maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

export async function getCourseDeletionBlockersRepository(courseId: string): Promise<CourseDeletionBlockers> {
  const supabase = createServiceRoleSupabaseClient();

  const [{ count: classCount, error: classError }, { count: materialCount, error: materialError }] = await Promise.all([
    supabase.from("classes").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    supabase.from("materials").select("id", { count: "exact", head: true }).eq("course_id", courseId),
  ]);

  if (classError) {
    throw classError;
  }

  if (materialError) {
    throw materialError;
  }

  return {
    classCount: classCount ?? 0,
    materialCount: materialCount ?? 0,
  };
}

export async function listActiveModeratorsRepository(): Promise<CourseModeratorOption[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "moderator")
    .eq("status", "active")
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ModeratorProfileRow[]).map(mapModeratorProfileRow);
}

export async function listActiveTeachersRepository(): Promise<CourseTeacherOption[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "teacher")
    .eq("status", "active")
    .order("full_name", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TeacherProfileRow[]).map(mapTeacherProfileRow);
}

export async function assignCourseModeratorRepository(input: AssignCourseModeratorRepositoryInput): Promise<CourseSummary | null> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("courses")
    .update({
      owner_id: input.moderatorId ?? input.ownerId,
    })
    .eq("id", input.courseId)
    .select(COURSE_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const { data: activeCourseScopes, error: activeCourseScopesError } = await supabase
    .from("permission_scopes")
    .select("id,actor_id,actor_profile:profiles!permission_scopes_actor_id_fkey(role)")
    .eq("scope_type", "course")
    .eq("scope_id", input.courseId)
    .eq("status", "active");

  if (activeCourseScopesError) {
    throw activeCourseScopesError;
  }

  const moderatorScopeIdsToRevoke = ((activeCourseScopes ?? []) as Array<{
    id: string;
    actor_id: string;
    actor_profile?: { role: "admin" | "moderator" | "teacher" | "student" } | { role: "admin" | "moderator" | "teacher" | "student" }[] | null;
  }>)
    .filter((scope) => {
      const actorProfile = Array.isArray(scope.actor_profile) ? scope.actor_profile[0] ?? null : scope.actor_profile ?? null;
      return actorProfile?.role === "moderator" && scope.actor_id !== input.moderatorId;
    })
    .map((scope) => scope.id);

  const { error: revokeError } = moderatorScopeIdsToRevoke.length > 0
    ? await supabase
    .from("permission_scopes")
    .update({
      status: "revoked",
    })
    .in("id", moderatorScopeIdsToRevoke)
    : { error: null };

  if (revokeError) {
    throw revokeError;
  }

  if (!input.moderatorId) {
    const [courseWithAssignments] = await attachAssignedTeachersToCourses([mapCourseRow(data as CourseRow)]);
    return courseWithAssignments;
  }

  const { data: existingScope, error: existingScopeError } = await supabase
    .from("permission_scopes")
    .select("id")
    .eq("actor_id", input.moderatorId)
    .eq("scope_type", "course")
    .eq("scope_id", input.courseId)
    .maybeSingle();

  if (existingScopeError) {
    throw existingScopeError;
  }

  const scopePayload = {
    actor_id: input.moderatorId,
    scope_type: "course",
    scope_id: input.courseId,
    permissions: {
      manage_course: true,
      manage_class: true,
      manage_members: true,
    },
    status: "active",
    granted_by: input.grantedBy,
  };

  const { error: scopeError } = existingScope?.id
    ? await supabase.from("permission_scopes").update(scopePayload).eq("id", existingScope.id)
    : await supabase.from("permission_scopes").insert(scopePayload);

  if (scopeError) {
    throw scopeError;
  }

  const [courseWithAssignments] = await attachAssignedTeachersToCourses([mapCourseRow(data as CourseRow)]);
  return courseWithAssignments;
}

export async function getCourseByIdRepository(courseId: string): Promise<CourseSummary | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("courses").select(COURSE_SELECT).eq("id", courseId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const [courseWithAssignments] = await attachAssignedTeachersToCourses([mapCourseRow(data as CourseRow)]);
  return courseWithAssignments;
}

export async function assignCourseTeachersRepository(input: AssignCourseTeachersRepositoryInput): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const uniqueTeacherIds = [...new Set(input.teacherIds)];

  const { data: existingScopes, error: existingScopesError } = await supabase
    .from("permission_scopes")
    .select("id,actor_id,actor_profile:profiles!permission_scopes_actor_id_fkey(role)")
    .eq("scope_type", "course")
    .eq("scope_id", input.courseId)
    .eq("status", "active");

  if (existingScopesError) {
    throw existingScopesError;
  }

  const teacherScopes = ((existingScopes ?? []) as Array<{
    id: string;
    actor_id: string;
    actor_profile?: { role: "admin" | "moderator" | "teacher" | "student" } | { role: "admin" | "moderator" | "teacher" | "student" }[] | null;
  }>).filter((scope) => {
    const actorProfile = Array.isArray(scope.actor_profile) ? scope.actor_profile[0] ?? null : scope.actor_profile ?? null;
    return actorProfile?.role === "teacher";
  });

  const scopeIdsToRevoke = teacherScopes.filter((scope) => !uniqueTeacherIds.includes(scope.actor_id)).map((scope) => scope.id);

  if (scopeIdsToRevoke.length > 0) {
    const { error: revokeError } = await supabase.from("permission_scopes").update({ status: "revoked" }).in("id", scopeIdsToRevoke);

    if (revokeError) {
      throw revokeError;
    }
  }

  const existingTeacherScopeByActorId = new Map(teacherScopes.map((scope) => [scope.actor_id, scope.id]));

  for (const teacherId of uniqueTeacherIds) {
    const scopePayload = {
      actor_id: teacherId,
      scope_type: "course",
      scope_id: input.courseId,
      permissions: {
        manage_course: true,
        manage_class: true,
        manage_members: true,
      },
      status: "active",
      granted_by: input.grantedBy,
    };

    const existingScopeId = existingTeacherScopeByActorId.get(teacherId);
    const { error: upsertError } = existingScopeId
      ? await supabase.from("permission_scopes").update(scopePayload).eq("id", existingScopeId)
      : await supabase.from("permission_scopes").insert(scopePayload);

    if (upsertError) {
      throw upsertError;
    }
  }
}

export async function listCourseChangeRequestsRepository(): Promise<CourseChangeRequest[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("course_change_requests")
    .select(COURSE_CHANGE_REQUEST_SELECT)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("course_change_requests")) {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as CourseChangeRequestRow[]).map(mapCourseChangeRequestRow);
}

export async function createCourseChangeRequestRepository(input: {
  action: "archive" | "delete";
  course: CourseSummary;
  requestedBy: string;
  reason?: string;
}): Promise<CourseChangeRequest> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("course_change_requests")
    .insert({
      action: input.action,
      target_course_id: input.course.id,
      target_code_snapshot: input.course.code,
      target_title_snapshot: input.course.title,
      requested_by: input.requestedBy,
      reason: input.reason ?? null,
      status: "pending_review",
    })
    .select(COURSE_CHANGE_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCourseChangeRequestRow(data as CourseChangeRequestRow);
}

export async function createCourseCreateRequestRepository(input: {
  requestedBy: string;
  code: string;
  title: string;
  description?: string;
  visibility: "private" | "unlisted" | "public_preview";
  credits?: number;
  knowledgeBlock?: "general" | "foundation" | "major";
  courseType?: "required" | "elective";
  cloItems: CourseCloItem[];
  assessmentComponents: CourseAssessmentComponent[];
}): Promise<CourseChangeRequest> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("course_change_requests")
    .insert({
      action: "create",
      requested_by: input.requestedBy,
      assigned_moderator_id: input.requestedBy,
      requested_code: input.code,
      requested_title: input.title,
      requested_description: input.description ?? null,
      requested_visibility: input.visibility,
      requested_credits: input.credits ?? null,
      requested_knowledge_block: input.knowledgeBlock ?? null,
      requested_course_type: input.courseType ?? null,
      requested_clo_items: input.cloItems,
      requested_assessment_components: input.assessmentComponents,
      target_code_snapshot: input.code,
      target_title_snapshot: input.title,
      status: "pending_review",
    })
    .select(COURSE_CHANGE_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCourseChangeRequestRow(data as CourseChangeRequestRow);
}

export async function createCourseUpdateRequestRepository(input: {
  targetCourseId: string;
  requestedBy: string;
  assignedModeratorId: string;
  codeSnapshot: string;
  titleSnapshot: string;
  title: string;
  description?: string;
  visibility: "private" | "unlisted" | "public_preview";
  status: "draft" | "active" | "archived";
  credits?: number;
  knowledgeBlock?: "general" | "foundation" | "major";
  courseType?: "required" | "elective";
  cloItems: CourseCloItem[];
  assessmentComponents: CourseAssessmentComponent[];
  reason?: string;
}): Promise<CourseChangeRequest> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("course_change_requests")
    .insert({
      action: "update",
      target_course_id: input.targetCourseId,
      requested_by: input.requestedBy,
      assigned_moderator_id: input.assignedModeratorId,
      requested_title: input.title,
      requested_description: input.description ?? null,
      requested_visibility: input.visibility,
      requested_status: input.status,
      requested_credits: input.credits ?? null,
      requested_knowledge_block: input.knowledgeBlock ?? null,
      requested_course_type: input.courseType ?? null,
      requested_clo_items: input.cloItems,
      requested_assessment_components: input.assessmentComponents,
      target_code_snapshot: input.codeSnapshot,
      target_title_snapshot: input.titleSnapshot,
      reason: input.reason ?? "Admin đề nghị chỉnh sửa học phần đã giao Mod quản lý.",
      status: "pending_review",
    })
    .select(COURSE_CHANGE_REQUEST_SELECT)
    .single();

  if (error) {
    throw error;
  }

  return mapCourseChangeRequestRow(data as CourseChangeRequestRow);
}

export async function getCourseChangeRequestByIdRepository(requestId: string): Promise<CourseChangeRequest | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("course_change_requests")
    .select(COURSE_CHANGE_REQUEST_SELECT)
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCourseChangeRequestRow(data as CourseChangeRequestRow) : null;
}

export async function reviewCourseChangeRequestRepository(input: {
  requestId: string;
  reviewedBy: string;
  status: "approved" | "rejected";
  reviewNote?: string;
}): Promise<CourseChangeRequest | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("course_change_requests")
    .update({
      status: input.status,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
    })
    .eq("id", input.requestId)
    .select(COURSE_CHANGE_REQUEST_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapCourseChangeRequestRow(data as CourseChangeRequestRow) : null;
}

export async function applyApprovedCourseChangeRequestRepository(input: {
  request: CourseChangeRequest;
  reviewedBy: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { request } = input;

  if (request.action === "create") {
    const { data, error } = await supabase
      .from("courses")
      .insert({
        owner_id: request.assignedModeratorId ?? request.requestedBy,
        code: request.requestedCode,
        title: request.requestedTitle,
        description: request.requestedDescription,
        visibility: request.requestedVisibility ?? "private",
        status: "active",
        credits: request.requestedCredits,
        knowledge_block: request.requestedKnowledgeBlock,
        course_type: request.requestedCourseType,
        clo_items: request.requestedCloItems,
        assessment_components: request.requestedAssessmentComponents,
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    await seedDefaultSimulationWidgetsForCourseRepository(data.id);

    if (request.assignedModeratorId) {
      const { error: scopeError } = await supabase.from("permission_scopes").insert({
        actor_id: request.assignedModeratorId,
        scope_type: "course",
        scope_id: data.id,
        permissions: {
          manage_course: true,
          manage_class: true,
          manage_members: true,
        },
        status: "active",
        granted_by: input.reviewedBy,
      });

      if (scopeError) {
        throw scopeError;
      }
    }

    return;
  }

  if (!request.targetCourseId) {
    throw new Error("COURSE_REQUEST_TARGET_MISSING");
  }

  if (request.action === "update") {
    const { error } = await supabase
      .from("courses")
      .update({
        title: request.requestedTitle,
        description: request.requestedDescription,
        visibility: request.requestedVisibility ?? "private",
        status: request.requestedStatus ?? "draft",
        credits: request.requestedCredits,
        knowledge_block: request.requestedKnowledgeBlock,
        course_type: request.requestedCourseType,
        clo_items: request.requestedCloItems,
        assessment_components: request.requestedAssessmentComponents,
      })
      .eq("id", request.targetCourseId);

    if (error) {
      throw error;
    }

    return;
  }

  if (request.action === "archive") {
    const { error } = await supabase.from("courses").update({ status: "archived" }).eq("id", request.targetCourseId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("courses").delete().eq("id", request.targetCourseId);

  if (error) {
    throw error;
  }
}
