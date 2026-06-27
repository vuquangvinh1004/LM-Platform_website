import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { DashboardActivityItem, DashboardCompletionPoint, DashboardStudentMessageNotice, TeacherDashboard, TeacherDashboardFilterInput } from "@/lib/types/dashboard";

type CourseRow = {
  id: string;
  code: string;
  title: string;
  status: "draft" | "active" | "archived";
};
type ClassRow = {
  id: string;
  course_id: string;
  teacher_id: string;
  class_code: string;
  title: string;
  status: "draft" | "active" | "archived";
};
type AssessmentRow = {
  id: string;
  class_id: string;
  title: string;
  status: "draft" | "open" | "closed" | "archived";
  created_at: string;
};
type ClassMemberRow = {
  class_id: string;
  student_id: string;
  status: "active" | "inactive" | "removed";
};
type SubmissionRow = {
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  status: "submitted" | "late" | "missing" | "ignored";
  normalized_score: number | null;
  raw_score: number | null;
  max_score: number | null;
};
type ActivityLogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type DashboardDirectMessageRow = {
  id: string;
  class_id: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  sender_profile: { full_name: string | null } | { full_name: string | null }[] | null;
  recipient_profile: { full_name: string | null } | { full_name: string | null }[] | null;
};

function firstProfileName(profile: { full_name: string | null } | { full_name: string | null }[] | null): string | null {
  if (Array.isArray(profile)) {
    return profile[0]?.full_name ?? null;
  }

  return profile?.full_name ?? null;
}

function buildStudentMessageNotices(input: {
  classes: ClassRow[];
  messages: DashboardDirectMessageRow[];
}): DashboardStudentMessageNotice[] {
  const classById = new Map(input.classes.map((courseClass) => [courseClass.id, courseClass]));
  const threadState = new Map<
    string,
    {
      classId: string;
      studentId: string;
      studentName: string | null;
      latestStudentMessageAt: string;
      replied: boolean;
    }
  >();
  const orderedMessages = [...input.messages].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());

  for (const message of orderedMessages) {
    const classInfo = classById.get(message.class_id);

    if (!classInfo) {
      continue;
    }

    const teacherId = classInfo.teacher_id;
    const isTeacherSender = message.sender_id === teacherId;
    const studentId = isTeacherSender ? message.recipient_id : message.sender_id;
    const studentName = isTeacherSender ? firstProfileName(message.recipient_profile) : firstProfileName(message.sender_profile);
    const threadKey = `${message.class_id}:${studentId}`;
    const currentThread = threadState.get(threadKey);

    if (!isTeacherSender && message.recipient_id === teacherId) {
      threadState.set(threadKey, {
        classId: message.class_id,
        studentId,
        studentName,
        latestStudentMessageAt: message.created_at,
        replied: false,
      });
      continue;
    }

    if (isTeacherSender && currentThread && new Date(message.created_at).getTime() >= new Date(currentThread.latestStudentMessageAt).getTime()) {
      threadState.set(threadKey, {
        ...currentThread,
        replied: true,
      });
    }
  }

  return Array.from(threadState.values())
    .sort((left, right) => new Date(right.latestStudentMessageAt).getTime() - new Date(left.latestStudentMessageAt).getTime())
    .map((thread) => ({
      id: `${thread.classId}:${thread.studentId}`,
      classId: thread.classId,
      studentId: thread.studentId,
      studentName: thread.studentName,
      createdAt: thread.latestStudentMessageAt,
      replied: thread.replied,
    }));
}

function toPercent(value: number): number {
  return Number(value.toFixed(2));
}

function isUuidLike(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function buildCompletionSeries(input: {
  assessments: AssessmentRow[];
  classMembers: ClassMemberRow[];
  submissions: SubmissionRow[];
}): DashboardCompletionPoint[] {
  const activeMemberIdsByClass = new Map<string, Set<string>>();

  for (const membership of input.classMembers) {
    if (membership.status !== "active") {
      continue;
    }

    if (!activeMemberIdsByClass.has(membership.class_id)) {
      activeMemberIdsByClass.set(membership.class_id, new Set<string>());
    }

    activeMemberIdsByClass.get(membership.class_id)?.add(membership.student_id);
  }

  const submissionsByAssessment = new Map<string, SubmissionRow[]>();
  for (const submission of input.submissions) {
    if (!submissionsByAssessment.has(submission.assessment_id)) {
      submissionsByAssessment.set(submission.assessment_id, []);
    }

    submissionsByAssessment.get(submission.assessment_id)?.push(submission);
  }

  const relevantAssessments = input.assessments.filter((assessment) => assessment.status === "open" || assessment.status === "closed");

  return relevantAssessments.map((assessment) => {
    const expectedSet = activeMemberIdsByClass.get(assessment.class_id) ?? new Set<string>();
    const expectedCount = expectedSet.size;
    const latestSubmissionByStudent = new Map<string, SubmissionRow>();

    for (const submission of submissionsByAssessment.get(assessment.id) ?? []) {
      if (!latestSubmissionByStudent.has(submission.student_id)) {
        latestSubmissionByStudent.set(submission.student_id, submission);
      }
    }

    const assessmentSubmissions = Array.from(latestSubmissionByStudent.values());

    const completedSet = new Set<string>();
    const scoreValues: number[] = [];

    for (const submission of assessmentSubmissions) {
      if (submission.status === "submitted" || submission.status === "late") {
        completedSet.add(submission.student_id);
      }

      if (submission.status === "ignored") {
        continue;
      }

      if (typeof submission.normalized_score === "number") {
        scoreValues.push(submission.normalized_score);
      } else if (
        typeof submission.raw_score === "number"
        && typeof submission.max_score === "number"
        && submission.max_score > 0
      ) {
        scoreValues.push((submission.raw_score / submission.max_score) * 100);
      }
    }

    const completedCount = completedSet.size;
    const completionRate = expectedCount > 0 ? toPercent((completedCount / expectedCount) * 100) : 0;
    const averageScore = scoreValues.length > 0
      ? toPercent(scoreValues.reduce((total, score) => total + score, 0) / scoreValues.length)
      : 0;

    return {
      assessmentId: assessment.id,
      assessmentTitle: assessment.title,
      classId: assessment.class_id,
      completionRate,
      completedCount,
      expectedCount,
      averageScore,
    };
  });
}

/**
 * Aggregates teacher dashboard metrics using RLS-scoped data.
 */
export async function getTeacherDashboardRepository(input: TeacherDashboardFilterInput = {}): Promise<TeacherDashboard> {
  const supabase = await createServerSupabaseClient();

  const [coursesResult, classesResult, assessmentsResult] = await Promise.all([
    supabase.from("courses").select("id,code,title,status").returns<CourseRow[]>(),
    supabase.from("classes").select("id,course_id,teacher_id,class_code,title,status").returns<ClassRow[]>(),
    supabase.from("assessments").select("id,class_id,title,status,created_at").returns<AssessmentRow[]>(),
  ]);

  if (coursesResult.error) {
    throw coursesResult.error;
  }

  if (classesResult.error) {
    throw classesResult.error;
  }

  if (assessmentsResult.error) {
    throw assessmentsResult.error;
  }

  const activeCourses = (coursesResult.data ?? []).filter((course) => course.status !== "archived");
  const activeClasses = (classesResult.data ?? []).filter((courseClass) => courseClass.status !== "archived");

  const selectedCourseId = isUuidLike(input.courseId) ? input.courseId : undefined;
  const selectedClassId = isUuidLike(input.classId) ? input.classId : undefined;

  const filteredClasses = activeClasses.filter((courseClass) => {
    if (selectedCourseId && courseClass.course_id !== selectedCourseId) {
      return false;
    }

    if (selectedClassId && courseClass.id !== selectedClassId) {
      return false;
    }

    return true;
  });

  const classIds = filteredClasses.map((courseClass) => courseClass.id);
  const classIdSet = new Set(classIds);

  const assessments = assessmentsResult.data ?? [];
  const filteredAssessments = assessments
    .filter((assessment) => classIdSet.has(assessment.class_id))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const assessmentIds = filteredAssessments.map((assessment) => assessment.id);
  const activitySupabase = createServiceRoleSupabaseClient();

  const activityResult = classIds.length > 0
    ? await activitySupabase
        .from("activity_logs")
        .select("id,action,entity_type,entity_id,created_at,metadata")
        .eq("entity_type", "class")
        .in("entity_id", classIds)
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<ActivityLogRow[]>()
    : { data: [], error: null };

  if (activityResult.error) {
    throw activityResult.error;
  }

  const directMessageResult = classIds.length > 0
    ? await activitySupabase
        .from("direct_messages")
        .select(
          "id,class_id,sender_id,recipient_id,created_at,sender_profile:profiles!direct_messages_sender_id_fkey(full_name),recipient_profile:profiles!direct_messages_recipient_id_fkey(full_name)",
        )
        .in("class_id", classIds)
        .order("created_at", { ascending: false })
        .limit(300)
        .returns<DashboardDirectMessageRow[]>()
    : { data: [], error: null };

  if (directMessageResult.error) {
    throw directMessageResult.error;
  }

  const [classMembersResult, submissionsResult] = await Promise.all([
    classIds.length > 0
      ? supabase
          .from("class_members")
          .select("class_id,student_id,status")
          .in("class_id", classIds)
          .returns<ClassMemberRow[]>()
      : Promise.resolve({ data: [], error: null } as { data: ClassMemberRow[]; error: null }),
    assessmentIds.length > 0
      ? supabase
          .from("submissions")
          .select("assessment_id,student_id,attempt_number,status,normalized_score,raw_score,max_score")
          .in("assessment_id", assessmentIds)
          .order("attempt_number", { ascending: false })
          .returns<SubmissionRow[]>()
      : Promise.resolve({ data: [], error: null } as { data: SubmissionRow[]; error: null }),
  ]);

  if (classMembersResult.error) {
    throw classMembersResult.error;
  }

  if (submissionsResult.error) {
    throw submissionsResult.error;
  }

  const completionSeries = buildCompletionSeries({
    assessments: filteredAssessments,
    classMembers: classMembersResult.data ?? [],
    submissions: submissionsResult.data ?? [],
  }).slice(0, 8);

  const totalExpected = completionSeries.reduce((total, item) => total + item.expectedCount, 0);
  const totalCompleted = completionSeries.reduce((total, item) => total + item.completedCount, 0);
  const completionRate = totalExpected > 0 ? toPercent((totalCompleted / totalExpected) * 100) : 0;

  const totalStudents = new Set(
    (classMembersResult.data ?? [])
      .filter((membership) => membership.status === "active")
      .map((membership) => membership.student_id),
  ).size;

  const totalAssessments = filteredAssessments.filter((assessment) => assessment.status !== "archived").length;

  const totalCourses = selectedCourseId
    ? activeCourses.filter((course) => course.id === selectedCourseId).length
    : activeCourses.length;

  const recentActivities: DashboardActivityItem[] = (activityResult.data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    createdAt: row.created_at,
    metadata: row.metadata ?? undefined,
  }));
  const studentMessageNotices = buildStudentMessageNotices({
    classes: filteredClasses.map((courseClass) => ({
      ...courseClass,
      teacher_id: courseClass.teacher_id,
    })),
    messages: directMessageResult.data ?? [],
  });

  return {
    totalCourses,
    totalClasses: filteredClasses.length,
    totalStudents,
    totalAssessments,
    completionRate,
    completionSeries,
    recentActivities,
    studentMessageNotices,
    selectedCourseId,
    selectedClassId,
    courses: activeCourses.map((course) => ({
      id: course.id,
      code: course.code,
      title: course.title,
    })),
    classes: activeClasses.map((courseClass) => ({
      id: courseClass.id,
      classCode: courseClass.class_code,
      title: courseClass.title,
      courseId: courseClass.course_id,
    })),
  };
}
