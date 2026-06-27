import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ManageableClassRecord } from "@/lib/repositories/class-repository";
import type { ClassResourceLinkTargetType, ClassResourceManagerData } from "@/lib/types/class-resource";
import type { LibraryMaterialItem, LibrarySimulationItem } from "@/lib/types/library";

type CourseRelation = { code: string; title: string } | { code: string; title: string }[] | null;
type CategoryRelation = { id: string; name: string } | { id: string; name: string }[] | null;

type ClassResourceClassRow = {
  id: string;
  course_id: string;
  class_code: string;
  title: string;
  course: CourseRelation;
};

type ClassResourceMaterialRow = {
  id: string;
  course_id: string;
  uploaded_by: string;
  category_id: string | null;
  title: string;
  description: string | null;
  section_label: string | null;
  tags: string[] | null;
  file_type: string;
  file_size: number;
  allow_download: boolean;
  status: "draft" | "published" | "archived";
  review_status: "pending_review" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  course: CourseRelation;
  category: CategoryRelation;
};

type ClassResourceSimulationRow = {
  id: string;
  course_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  course: CourseRelation;
  category: CategoryRelation;
};

type ClassResourceLinkRow = {
  target_type: ClassResourceLinkTargetType;
  target_id: string;
};

function firstCourse(course: CourseRelation): { code: string; title: string } | null {
  return Array.isArray(course) ? course[0] ?? null : course;
}

function firstCategory(category: CategoryRelation): { id: string; name: string } | null {
  return Array.isArray(category) ? category[0] ?? null : category;
}

function isMissingClassResourceLinks(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("class_resource_links") === true;
}

function toLibraryMaterial(row: ClassResourceMaterialRow): LibraryMaterialItem {
  const course = firstCourse(row.course);
  const category = firstCategory(row.category);

  return {
    id: row.id,
    courseId: row.course_id,
    uploadedBy: row.uploaded_by,
    courseCode: course?.code ?? "",
    courseTitle: course?.title ?? "",
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    title: row.title,
    description: row.description,
    sectionLabel: row.section_label,
    tags: row.tags ?? [],
    fileType: row.file_type,
    fileSize: row.file_size,
    allowDownload: row.allow_download,
    status: row.status,
    reviewStatus: row.review_status,
    reviewNote: row.review_note,
    createdAt: row.created_at,
  };
}

function toLibrarySimulation(row: ClassResourceSimulationRow): LibrarySimulationItem {
  const course = firstCourse(row.course);
  const category = firstCategory(row.category);

  return {
    id: row.id,
    courseId: row.course_id,
    courseCode: course?.code ?? "",
    courseTitle: course?.title ?? "",
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    slug: row.slug,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function getClassResourceManagerDataRepository(
  classId: string,
  classInfo?: Pick<ManageableClassRecord, "id" | "courseId" | "classCode" | "title" | "courseCode" | "courseTitle">,
): Promise<ClassResourceManagerData | null> {
  const supabase = createServiceRoleSupabaseClient();

  const classRow = classInfo
    ? {
        id: classInfo.id,
        course_id: classInfo.courseId,
        class_code: classInfo.classCode ?? "",
        title: classInfo.title,
        course: { code: classInfo.courseCode ?? "", title: classInfo.courseTitle ?? "" },
      }
    : await (async () => {
        const { data, error } = await supabase
          .from("classes")
          .select("id,course_id,class_code,title,course:courses(code,title)")
          .eq("id", classId)
          .maybeSingle<ClassResourceClassRow>();

        if (error) {
          throw error;
        }

        return data ?? null;
      })();

  if (!classRow) {
    return null;
  }

  const [materialsResult, simulationsResult, linksResult] = await Promise.all([
    supabase
      .from("materials")
      .select(
        "id,course_id,uploaded_by,category_id,title,description,section_label,tags,file_type,file_size,allow_download,status,review_status,review_note,created_at,course:courses(code,title),category:library_categories(id,name)",
      )
      .eq("course_id", classRow.course_id)
      .eq("review_status", "approved")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .returns<ClassResourceMaterialRow[]>(),
    supabase
      .from("simulations")
      .select(
        "id,course_id,category_id,slug,title,description,tags,status,created_at,course:courses(code,title),category:library_categories(id,name)",
      )
      .eq("course_id", classRow.course_id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .returns<ClassResourceSimulationRow[]>(),
    supabase
      .from("class_resource_links")
      .select("target_type,target_id")
      .eq("class_id", classId)
      .returns<ClassResourceLinkRow[]>(),
  ]);

  if (materialsResult.error) {
    throw materialsResult.error;
  }

  if (simulationsResult.error) {
    if (!isMissingClassResourceLinks(simulationsResult.error)) {
      throw simulationsResult.error;
    }
  }

  let links: ClassResourceLinkRow[] = [];

  if (linksResult.error) {
    if (!isMissingClassResourceLinks(linksResult.error)) {
      throw linksResult.error;
    }
  } else {
    links = linksResult.data ?? [];
  }

  const course = firstCourse(classRow.course);

  return {
    classId: classRow.id,
    classCode: classRow.class_code,
    classTitle: classRow.title,
    courseCode: course?.code ?? "",
    courseTitle: course?.title ?? "",
    materials: (materialsResult.data ?? []).map(toLibraryMaterial),
    simulations: (simulationsResult.data ?? []).map(toLibrarySimulation),
    linkedMaterialIds: links.filter((link) => link.target_type === "material").map((link) => link.target_id),
    linkedSimulationIds: links.filter((link) => link.target_type === "simulation").map((link) => link.target_id),
  };
}

export async function replaceClassResourceLinksRepository(input: {
  classId: string;
  linkedBy: string;
  materialIds: string[];
  simulationIds: string[];
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { error: deleteError } = await supabase.from("class_resource_links").delete().eq("class_id", input.classId);

  if (deleteError) {
    throw deleteError;
  }

  const rows: Array<{
    class_id: string;
    target_type: ClassResourceLinkTargetType;
    target_id: string;
    linked_by: string;
  }> = [
    ...input.materialIds.map((targetId) => ({
      class_id: input.classId,
      target_type: "material" as const,
      target_id: targetId,
      linked_by: input.linkedBy,
    })),
    ...input.simulationIds.map((targetId) => ({
      class_id: input.classId,
      target_type: "simulation" as const,
      target_id: targetId,
      linked_by: input.linkedBy,
    })),
  ];

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase.from("class_resource_links").insert(rows);

  if (error) {
    throw error;
  }
}
