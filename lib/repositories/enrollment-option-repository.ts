import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { EnrollmentOption } from "@/lib/types/enrollment-option";

type OpenEnrollmentOptionRow = {
  id: string;
  class_code: string;
  title: string;
  semester: string | null;
  academic_year: string | null;
  course_id: string;
  courses: {
    id: string;
    code: string;
    title: string;
  } | null;
};

/**
 * Returns active course/class options shown to students before enrollment requests.
 */
export async function listOpenEnrollmentOptionsRepository(): Promise<EnrollmentOption[]> {
  const supabase = createServiceRoleSupabaseClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id,class_code,title,semester,academic_year,course_id,courses!inner(id,code,title)")
    .eq("status", "active")
    .eq("is_open_for_enrollment", true)
    .eq("courses.status", "active")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<OpenEnrollmentOptionRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    courseId: row.course_id,
    courseCode: row.courses?.code ?? "",
    courseTitle: row.courses?.title ?? "",
    classId: row.id,
    classCode: row.class_code,
    classTitle: row.title,
    semester: row.semester ?? undefined,
    academicYear: row.academic_year ?? undefined,
  }));
}
