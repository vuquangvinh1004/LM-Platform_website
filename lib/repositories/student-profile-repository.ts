import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { StudentProfileOverview } from "@/lib/types/student-profile";

/**
 * Loads lightweight student profile overview. This is intentionally summary-oriented.
 */
export async function getStudentProfileOverviewRepository(studentId: string): Promise<StudentProfileOverview | null> {
  const supabase = await createServerSupabaseClient();

  const [
    { data: profile, error: profileError },
    { data: stats, error: statsError },
    { data: courseStatsRows, error: courseStatsError },
    { data: membershipRows, error: membershipRowsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name,student_code,access_status,access_expires_at")
      .eq("id", studentId)
      .eq("role", "student")
      .maybeSingle(),
    supabase
      .from("student_profile_stats")
      .select("total_assessments,completed_assessments,average_score,weekly_active_count,monthly_active_count,total_access_minutes")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_course_stats")
      .select("course_id,completed_assessments,average_score,courses!inner(id,code,title)")
      .eq("student_id", studentId)
      .returns<Array<{
        course_id: string;
        completed_assessments: number;
        average_score: number | null;
        courses: {
          id: string;
          code: string;
          title: string;
        } | null;
      }>>(),
    supabase
      .from("class_members")
      .select("classes!inner(course_id,courses!inner(id,code,title))")
      .eq("student_id", studentId)
      .eq("status", "active"),
  ]);

  if (profileError) {
    throw profileError;
  }

  if (statsError) {
    throw statsError;
  }

  if (courseStatsError) {
    throw courseStatsError;
  }

  if (membershipRowsError) {
    throw membershipRowsError;
  }

  if (!profile) {
    return null;
  }

  const courseMap = new Map<string, {
    courseCode: string;
    courseTitle: string;
    completedAssessments: number;
    averageScore?: number;
  }>();

  for (const row of courseStatsRows ?? []) {
    const courseId = row.course_id;

    if (!courseId || courseMap.has(courseId)) {
      continue;
    }

    courseMap.set(courseId, {
      courseCode: row.courses?.code ?? "",
      courseTitle: row.courses?.title ?? "",
      completedAssessments: row.completed_assessments,
      averageScore: row.average_score ?? undefined,
    });
  }

  for (const row of membershipRows ?? []) {
    const course = (row as {
      classes?: {
        course_id?: string;
        courses?: {
          id?: string;
          code?: string;
          title?: string;
        };
      };
    }).classes?.courses;

    const courseId = course?.id;
    if (!courseId || courseMap.has(courseId)) {
      continue;
    }

    courseMap.set(courseId, {
      courseCode: course.code ?? "",
      courseTitle: course.title ?? "",
      completedAssessments: 0,
      averageScore: undefined,
    });
  }

  return {
    personalInfo: {
      fullName: profile.full_name,
      studentCode: profile.student_code ?? undefined,
    },
    access: {
      accessStatus: profile.access_status,
      accessExpiresAt: profile.access_expires_at ?? undefined,
    },
    summary: {
      totalAssessments: stats?.total_assessments ?? 0,
      completedAssessments: stats?.completed_assessments ?? 0,
      averageScore: stats?.average_score ?? undefined,
      weeklyActiveCount: stats?.weekly_active_count ?? undefined,
      monthlyActiveCount: stats?.monthly_active_count ?? undefined,
      totalAccessMinutes: stats?.total_access_minutes ?? undefined,
    },
    courseBreakdown: Array.from(courseMap.entries()).map(([courseId, course]) => ({
      courseId,
      courseCode: course.courseCode,
      courseTitle: course.courseTitle,
      completedAssessments: course.completedAssessments,
      averageScore: course.averageScore,
    })),
    badges: [],
  };
}
