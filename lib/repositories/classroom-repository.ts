import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type {
  ClassroomAnnouncement,
  ClassroomClassInfo,
  ClassroomTemplateSummary,
  ClassroomSessionAssignment,
  ClassroomSessionStudentAccess,
  ClassroomSessionDetail,
  ClassroomSessionExtraMaterial,
  ClassroomSessionLectureItem,
  ClassroomSessionQuickReviewQuestion,
  ClassroomSessionSummary,
  ClassroomMaterialItem,
  ClassroomMemberRecord,
  ClassroomSimulationItem,
} from "@/lib/types/classroom";

type ClassInfoRow = {
  id: string;
  course_id: string;
  class_code: string;
  title: string;
  teacher_id: string;
  teacher_desk_note: string | null;
  course: { code: string; title: string } | { code: string; title: string }[] | null;
  teacher_profile: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};

type ClassroomMemberRow = {
  id: string;
  student_id: string;
  full_name_snapshot: string | null;
  student_code_snapshot: string | null;
  profile: { full_name: string; student_code: string | null } | { full_name: string; student_code: string | null }[] | null;
};

type AnnouncementRow = {
  id: string;
  class_id: string;
  title: string;
  content: string;
  status: "published" | "archived";
  created_at: string;
};

type MaterialRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  section_label: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  category: { name: string } | { name: string }[] | null;
  created_at: string;
};

type SimulationRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  config: unknown;
  status: string;
  created_at: string;
};

type ClassSessionRow = {
  id: string;
  class_id: string;
  session_index: number;
  title: string | null;
  status: "planned" | "completed" | "cancelled";
  student_access: "open" | "locked" | "scheduled";
  available_from: string | null;
  overview_content: string | null;
  overview_objectives: string | null;
  lecture_items: unknown;
  extra_materials: unknown;
  assignments: unknown;
  quick_review_questions: unknown;
  created_at: string;
  classes?: ClassInfoRow | ClassInfoRow[] | null;
};

type ClassTemplateRow = {
  id: string;
  course_id: string;
  source_class_id: string | null;
  created_by: string;
  name: string;
  description: string | null;
  teacher_desk_note: string | null;
  linked_material_ids: string[] | null;
  linked_simulation_ids: string[] | null;
  session_blueprint: unknown;
  created_at: string;
};

type ClassTemplateBlueprintSession = {
  title?: string;
  overviewContent?: string;
  overviewObjectives?: string;
  lectureItems?: ClassroomSessionLectureItem[];
  extraMaterials?: ClassroomSessionExtraMaterial[];
  assignments?: ClassroomSessionAssignment[];
  quickReviewQuestions?: ClassroomSessionQuickReviewQuestion[];
  studentAccess?: ClassroomSessionStudentAccess;
};

type ClassResourceLinkRow = {
  target_id: string;
};

function toSingleRecord<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] ?? null : value;
}

function mapClassInfoRow(row: ClassInfoRow): ClassroomClassInfo {
  const course = toSingleRecord(row.course);
  const teacherProfile = toSingleRecord(row.teacher_profile);

  return {
    id: row.id,
    courseId: row.course_id,
    classCode: row.class_code,
    classTitle: row.title,
    courseCode: course?.code ?? "",
    courseTitle: course?.title ?? "",
    teacherId: row.teacher_id,
    teacherName: teacherProfile?.full_name ?? null,
    teacherEmail: teacherProfile?.email ?? null,
    teacherDeskNote: row.teacher_desk_note ?? null,
  };
}

/**
 * Returns class metadata visible to current actor under RLS policies.
 */
export async function getClassroomClassInfoRepository(classId: string): Promise<ClassroomClassInfo | null> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id,course_id,class_code,title,teacher_id,teacher_desk_note,course:courses(code,title),teacher_profile:profiles!classes_teacher_id_fkey(full_name,email)")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapClassInfoRow(data as ClassInfoRow);
}

/**
 * Verifies current actor can read one class row under active RLS policies.
 */
export async function hasClassroomAccessRepository(classId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("classes").select("id").eq("id", classId).maybeSingle<{ id: string }>();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

function fallbackSessionTitle(row: Pick<ClassSessionRow, "session_index" | "title">): string {
  return row.title?.trim() || `Buổi học ${row.session_index}`;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function mapClassSessionSummaryRow(row: ClassSessionRow): ClassroomSessionSummary {
  const isAccessibleToStudents =
    row.student_access === "open"
      ? true
      : row.student_access === "scheduled"
        ? Boolean(row.available_from && new Date(row.available_from).getTime() <= Date.now())
        : false;

  return {
    id: row.id,
    classId: row.class_id,
    sessionIndex: row.session_index,
    title: fallbackSessionTitle(row),
    status: row.status,
    studentAccess: row.student_access,
    availableFrom: row.available_from,
    isAccessibleToStudents,
    createdAt: row.created_at,
  };
}

function mapClassSessionDetailRow(row: ClassSessionRow, classInfo: ClassroomClassInfo): ClassroomSessionDetail {
  return {
    ...mapClassSessionSummaryRow(row),
    classInfo,
    overviewContent: row.overview_content ?? undefined,
    overviewObjectives: row.overview_objectives ?? undefined,
    lectureItems: asArray<ClassroomSessionLectureItem>(row.lecture_items),
    extraMaterials: asArray<ClassroomSessionExtraMaterial>(row.extra_materials),
    assignments: asArray<ClassroomSessionAssignment>(row.assignments),
    quickReviewQuestions: asArray<ClassroomSessionQuickReviewQuestion>(row.quick_review_questions),
  };
}

async function listLinkedResourceIdsRepository(
  classId: string,
  targetType: "material" | "simulation",
): Promise<{ ids: string[]; tableExists: boolean }> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("class_resource_links")
    .select("target_id")
    .eq("class_id", classId)
    .eq("target_type", targetType)
    .returns<ClassResourceLinkRow[]>();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("class_resource_links")) {
      return { ids: [], tableExists: false };
    }

    throw error;
  }

  return {
    ids: (data ?? []).map((row) => row.target_id),
    tableExists: true,
  };
}

/**
 * Returns class metadata with profile enrichment after caller has already
 * verified classroom visibility under the current actor session.
 */
export async function getClassroomClassInfoForDisplayRepository(classId: string): Promise<ClassroomClassInfo | null> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id,course_id,class_code,title,teacher_id,teacher_desk_note,course:courses(code,title),teacher_profile:profiles!classes_teacher_id_fkey(full_name,email)")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapClassInfoRow(data as ClassInfoRow);
}

/**
 * Returns active class members to build deterministic seating.
 */
export async function listActiveClassMembersRepository(classId: string): Promise<ClassroomMemberRecord[]> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("class_members")
    .select("id,student_id,full_name_snapshot,student_code_snapshot,profile:profiles(full_name,student_code)")
    .eq("class_id", classId)
    .eq("status", "active");

  if (error) {
    throw error;
  }

  return ((data ?? []) as ClassroomMemberRow[]).map((row) => {
    const profile = toSingleRecord(row.profile);

    return {
      id: row.id,
      studentId: row.student_id,
      fullName: row.full_name_snapshot ?? profile?.full_name ?? "Sinh viên chưa cập nhật tên",
      studentCode: row.student_code_snapshot ?? profile?.student_code ?? null,
    };
  });
}

/**
 * Reads published class announcements with pagination.
 */
export async function listClassAnnouncementsRepository(
  classId: string,
  page: number,
  pageSize: number,
): Promise<ClassroomAnnouncement[]> {
  const supabase = await createServerSupabaseClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from("class_announcements")
    .select("id,class_id,title,content,status,created_at")
    .eq("class_id", classId)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  return ((data ?? []) as AnnouncementRow[]).map((row) => ({
    id: row.id,
    classId: row.class_id,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  }));
}

/**
 * Creates one published class announcement under class management scope.
 */
export async function createClassAnnouncementRepository(input: {
  classId: string;
  actorId: string;
  title: string;
  content: string;
}): Promise<ClassroomAnnouncement> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("class_announcements")
    .insert({
      class_id: input.classId,
      created_by: input.actorId,
      title: input.title,
      content: input.content,
      status: "published",
    })
    .select("id,class_id,title,content,status,created_at")
    .single();

  if (error) {
    throw error;
  }

  const row = data as AnnouncementRow;

  return {
    id: row.id,
    classId: row.class_id,
    title: row.title,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Reads class materials under class course context.
 */
export async function listClassroomMaterialsRepository(classId: string): Promise<ClassroomMaterialItem[]> {
  const classInfo = await getClassroomClassInfoRepository(classId);

  if (!classInfo) {
    return [];
  }

  const linkedIds = await listLinkedResourceIdsRepository(classId, "material");

  if (linkedIds.tableExists && linkedIds.ids.length === 0) {
    return [];
  }

  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("materials")
    .select("id,title,status,section_label,storage_bucket,storage_path,created_at,category:library_categories(name)")
    .eq("course_id", classInfo.courseId)
    .eq("review_status", "approved")
    .neq("status", "archived")
    .not("storage_bucket", "is", null)
    .not("storage_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (linkedIds.tableExists) {
    query = query.in("id", linkedIds.ids);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as MaterialRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    sectionLabel: row.section_label,
    categoryName: Array.isArray(row.category) ? row.category[0]?.name ?? null : row.category?.name ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Reads simulations for the class course context.
 * Returns empty list when simulation registry table is not available yet.
 */
export async function listClassroomSimulationsRepository(classId: string): Promise<ClassroomSimulationItem[]> {
  const classInfo = await getClassroomClassInfoRepository(classId);

  if (!classInfo) {
    return [];
  }

  const linkedIds = await listLinkedResourceIdsRepository(classId, "simulation");

  if (linkedIds.tableExists && linkedIds.ids.length === 0) {
    return [];
  }

  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("simulations")
    .select("id,slug,title,description,config,status,created_at")
    .eq("course_id", classInfo.courseId)
    .neq("status", "archived")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);

  if (linkedIds.tableExists) {
    query = query.in("id", linkedIds.ids);
  }

  const { data, error } = await query;

  if (error) {
    const postgresError = error as { code?: string };

    if (postgresError.code === "42P01") {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as SimulationRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    openUrl: getSimulationOpenUrl(row.config),
    createdAt: row.created_at,
  }));
}

export async function listClassSessionsRepository(classId: string, useServiceRole: boolean = false): Promise<ClassroomSessionSummary[]> {
  const supabase = useServiceRole ? createServiceRoleSupabaseClient() : await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("class_sessions")
    .select("id,class_id,session_index,title,status,student_access,available_from,created_at")
    .eq("class_id", classId)
    .neq("status", "cancelled")
    .order("session_index", { ascending: true })
    .returns<ClassSessionRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapClassSessionSummaryRow);
}

export async function createClassSessionRepository(input: {
  classId: string;
  title: string;
}): Promise<ClassroomSessionSummary> {
  const supabase = await createServerSupabaseClient();

  const { data: latestRows, error: latestError } = await supabase
    .from("class_sessions")
    .select("session_index")
    .eq("class_id", input.classId)
    .order("session_index", { ascending: false })
    .limit(1)
    .returns<Array<{ session_index: number }>>();

  if (latestError) {
    throw latestError;
  }

  const nextSessionIndex = (latestRows?.[0]?.session_index ?? 0) + 1;
  const startAt = new Date().toISOString();
  const endAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("class_sessions")
    .insert({
      class_id: input.classId,
      session_index: nextSessionIndex,
      title: input.title,
      start_at: startAt,
      end_at: endAt,
      status: "planned",
      student_access: "open",
    })
    .select("id,class_id,session_index,title,status,student_access,available_from,created_at")
    .single<ClassSessionRow>();

  if (error) {
    throw error;
  }

  return mapClassSessionSummaryRow(data);
}

export async function getClassSessionDetailRepository(input: {
  classId: string;
  sessionId: string;
  useServiceRole?: boolean;
}): Promise<ClassroomSessionDetail | null> {
  const supabase = input.useServiceRole ? createServiceRoleSupabaseClient() : await createServerSupabaseClient();

  const fullSelect =
    "id,class_id,session_index,title,status,student_access,available_from,overview_content,overview_objectives,lecture_items,extra_materials,assignments,quick_review_questions,created_at,classes(id,course_id,class_code,title,teacher_id,teacher_desk_note,course:courses(code,title),teacher_profile:profiles!classes_teacher_id_fkey(full_name,email))";
  const fallbackSelect =
    "id,class_id,session_index,title,status,student_access,available_from,created_at,classes(id,course_id,class_code,title,teacher_id,teacher_desk_note,course:courses(code,title),teacher_profile:profiles!classes_teacher_id_fkey(full_name,email))";

  let result = await supabase
    .from("class_sessions")
    .select(fullSelect)
    .eq("class_id", input.classId)
    .eq("id", input.sessionId)
    .maybeSingle<ClassSessionRow>();

  if (result.error && (result.error.code === "PGRST204" || result.error.message.includes("overview_content"))) {
    result = await supabase
      .from("class_sessions")
      .select(fallbackSelect)
      .eq("class_id", input.classId)
      .eq("id", input.sessionId)
      .maybeSingle<ClassSessionRow>();
  }

  if (result.error) {
    throw result.error;
  }

  if (!result.data) {
    return null;
  }

  const classRow = toSingleRecord(result.data.classes);

  if (!classRow) {
    return null;
  }

  return mapClassSessionDetailRow(result.data, mapClassInfoRow(classRow));
}

export async function updateClassSessionRepository(input: {
  classId: string;
  sessionId: string;
  title?: string;
  studentAccess?: ClassroomSessionStudentAccess;
  availableFrom?: string | null;
  overviewContent?: string;
  overviewObjectives?: string;
  lectureItems?: ClassroomSessionLectureItem[];
  extraMaterials?: ClassroomSessionExtraMaterial[];
  assignments?: ClassroomSessionAssignment[];
  quickReviewQuestions?: ClassroomSessionQuickReviewQuestion[];
}): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const payload: Record<string, unknown> = {};

  if (input.title !== undefined) {
    payload.title = input.title;
  }

  if (input.studentAccess !== undefined) {
    payload.student_access = input.studentAccess;
  }

  if (input.availableFrom !== undefined) {
    payload.available_from = input.availableFrom;
  }

  if (input.overviewContent !== undefined) {
    payload.overview_content = input.overviewContent || null;
  }

  if (input.overviewObjectives !== undefined) {
    payload.overview_objectives = input.overviewObjectives || null;
  }

  if (input.lectureItems !== undefined) {
    payload.lecture_items = input.lectureItems;
  }

  if (input.extraMaterials !== undefined) {
    payload.extra_materials = input.extraMaterials;
  }

  if (input.assignments !== undefined) {
    payload.assignments = input.assignments;
  }

  if (input.quickReviewQuestions !== undefined) {
    payload.quick_review_questions = input.quickReviewQuestions;
  }

  const { error } = await supabase
    .from("class_sessions")
    .update(payload)
    .eq("class_id", input.classId)
    .eq("id", input.sessionId);

  if (error) {
    throw error;
  }
}

function mapClassTemplateRow(row: ClassTemplateRow): ClassroomTemplateSummary {
  const sessions = asArray<ClassTemplateBlueprintSession>(row.session_blueprint);

  return {
    id: row.id,
    courseId: row.course_id,
    sourceClassId: row.source_class_id,
    createdBy: row.created_by,
    name: row.name,
    description: row.description,
    teacherDeskNote: row.teacher_desk_note,
    sessionCount: sessions.length,
    materialCount: row.linked_material_ids?.length ?? 0,
    simulationCount: row.linked_simulation_ids?.length ?? 0,
    createdAt: row.created_at,
  };
}

export async function listClassTemplatesRepository(courseId: string, createdBy?: string): Promise<ClassroomTemplateSummary[]> {
  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("class_templates")
    .select("id,course_id,source_class_id,created_by,name,description,teacher_desk_note,linked_material_ids,linked_simulation_ids,session_blueprint,created_at")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  if (createdBy) {
    query = query.eq("created_by", createdBy);
  }

  const { data, error } = await query.returns<ClassTemplateRow[]>();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("class_templates")) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map(mapClassTemplateRow);
}

export async function listClassTemplatesByCourseIdsRepository(courseIds: string[], createdBy?: string): Promise<ClassroomTemplateSummary[]> {
  if (courseIds.length === 0) {
    return [];
  }

  const supabase = createServiceRoleSupabaseClient();
  let query = supabase
    .from("class_templates")
    .select("id,course_id,source_class_id,created_by,name,description,teacher_desk_note,linked_material_ids,linked_simulation_ids,session_blueprint,created_at")
    .in("course_id", courseIds)
    .order("created_at", { ascending: false });

  if (createdBy) {
    query = query.eq("created_by", createdBy);
  }

  const { data, error } = await query.returns<ClassTemplateRow[]>();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("class_templates")) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map(mapClassTemplateRow);
}

export async function createClassTemplateRepository(input: {
  courseId: string;
  sourceClassId: string;
  actorId: string;
  name: string;
  description?: string;
  teacherDeskNote?: string | null;
  linkedMaterialIds: string[];
  linkedSimulationIds: string[];
  sessionBlueprint: ClassTemplateBlueprintSession[];
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("class_templates").insert({
    course_id: input.courseId,
    source_class_id: input.sourceClassId,
    created_by: input.actorId,
    name: input.name,
    description: input.description ?? null,
    teacher_desk_note: input.teacherDeskNote ?? null,
    linked_material_ids: input.linkedMaterialIds,
    linked_simulation_ids: input.linkedSimulationIds,
    session_blueprint: input.sessionBlueprint,
  });

  if (error) {
    throw error;
  }
}

export async function deleteClassTemplateRepository(templateId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("class_templates").delete().eq("id", templateId);

  if (error) {
    throw error;
  }
}

export async function getClassTemplateByIdRepository(templateId: string): Promise<ClassTemplateRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("class_templates")
    .select("id,course_id,source_class_id,created_by,name,description,teacher_desk_note,linked_material_ids,linked_simulation_ids,session_blueprint,created_at")
    .eq("id", templateId)
    .maybeSingle<ClassTemplateRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function getClassTemplateBySourceClassIdRepository(sourceClassId: string): Promise<ClassTemplateRow | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("class_templates")
    .select("id,course_id,source_class_id,created_by,name,description,teacher_desk_note,linked_material_ids,linked_simulation_ids,session_blueprint,created_at")
    .eq("source_class_id", sourceClassId)
    .maybeSingle<ClassTemplateRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function updateClassTemplateRepository(input: {
  templateId: string;
  name: string;
  description?: string | null;
  teacherDeskNote?: string | null;
  linkedMaterialIds: string[];
  linkedSimulationIds: string[];
  sessionBlueprint: ClassTemplateBlueprintSession[];
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase
    .from("class_templates")
    .update({
      name: input.name,
      description: input.description ?? null,
      teacher_desk_note: input.teacherDeskNote ?? null,
      linked_material_ids: input.linkedMaterialIds,
      linked_simulation_ids: input.linkedSimulationIds,
      session_blueprint: input.sessionBlueprint,
    })
    .eq("id", input.templateId);

  if (error) {
    throw error;
  }
}

export async function countClassSessionsRepository(classId: string): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  const { count, error } = await supabase
    .from("class_sessions")
    .select("id", { count: "exact", head: true })
    .eq("class_id", classId)
    .neq("status", "cancelled");

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function countClassResourceLinksRepository(classId: string): Promise<number> {
  const supabase = createServiceRoleSupabaseClient();
  const { count, error } = await supabase
    .from("class_resource_links")
    .select("target_id", { count: "exact", head: true })
    .eq("class_id", classId);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("class_resource_links")) {
      return 0;
    }

    throw error;
  }

  return count ?? 0;
}

export async function listClassResourceLinkIdsRepository(classId: string): Promise<{ materialIds: string[]; simulationIds: string[] }> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("class_resource_links")
    .select("target_type,target_id")
    .eq("class_id", classId)
    .returns<Array<{ target_type: "material" | "simulation"; target_id: string }>>();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("class_resource_links")) {
      return { materialIds: [], simulationIds: [] };
    }

    throw error;
  }

  return {
    materialIds: (data ?? []).filter((row) => row.target_type === "material").map((row) => row.target_id),
    simulationIds: (data ?? []).filter((row) => row.target_type === "simulation").map((row) => row.target_id),
  };
}

export async function createClassSessionsFromTemplateRepository(input: {
  classId: string;
  sessions: ClassTemplateBlueprintSession[];
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  if (input.sessions.length === 0) {
    return;
  }

  const now = Date.now();
  const rows = input.sessions.map((session, index) => {
    const startAt = new Date(now + index * 90 * 60 * 1000).toISOString();
    const endAt = new Date(now + (index + 1) * 90 * 60 * 1000).toISOString();

    return {
      class_id: input.classId,
      session_index: index + 1,
      title: session.title ?? `Buổi học ${index + 1}`,
      start_at: startAt,
      end_at: endAt,
      status: "planned" as const,
      student_access: session.studentAccess === "scheduled" ? "locked" : session.studentAccess ?? "open",
      available_from: null,
      overview_content: session.overviewContent ?? null,
      overview_objectives: session.overviewObjectives ?? null,
      lecture_items: session.lectureItems ?? [],
      extra_materials: session.extraMaterials ?? [],
      assignments: session.assignments ?? [],
      quick_review_questions: session.quickReviewQuestions ?? [],
    };
  });

  const { error } = await supabase.from("class_sessions").insert(rows);

  if (error) {
    throw error;
  }
}

export async function deleteClassSessionsByClassIdRepository(classId: string): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const { error } = await supabase.from("class_sessions").delete().eq("class_id", classId);

  if (error) {
    throw error;
  }
}

export async function updateClassTeacherDeskNoteRepository(input: {
  classId: string;
  note?: string;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("classes")
    .update({
      teacher_desk_note: input.note?.trim() ? input.note.trim() : null,
    })
    .eq("id", input.classId);

  if (error) {
    throw error;
  }
}

function getSimulationOpenUrl(config: unknown): string | null {
  if (!config || typeof config !== "object") {
    return null;
  }

  const uploadId = (config as { uploadId?: unknown; source?: unknown }).uploadId;
  const source = (config as { uploadId?: unknown; source?: unknown }).source;

  if (source !== "html_upload" || typeof uploadId !== "string") {
    return null;
  }

  return `/api/library/simulation-uploads/${uploadId}/open`;
}
