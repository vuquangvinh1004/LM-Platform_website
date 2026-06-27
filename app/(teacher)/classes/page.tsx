import { ClassManagementClient } from "@/app/(teacher)/classes/class-management-client";
import { AdminAreaLink } from "@/components/ui/admin-area-link";
import { BackTextLink } from "@/components/ui/back-text-link";
import { listClassMembersByClassIdsRepository } from "@/lib/repositories/class-repository";
import { listClassTemplatesByCourseIdsRepository } from "@/lib/repositories/classroom-repository";
import { requireRole } from "@/lib/services/auth-service";
import { listClassChangeRequests, listClassesForUser } from "@/lib/services/class-service";
import { listCoursesForUser } from "@/lib/services/course-service";
import { listEnrollmentRequestsByClassIds } from "@/lib/services/enrollment-service";
import { timed } from "@/lib/utils/timing";

type ClassesPageSearchParams = {
  focusClassId?: string;
};

export default async function ClassesPage(
  { searchParams }: { searchParams?: Promise<ClassesPageSearchParams> },
) {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý lớp</h1>
        <p className="mt-2 text-sm text-red-600">{profileResult.error.message}</p>
        <BackTextLink className="mt-4" href="/login">Quay lại đăng nhập</BackTextLink>
      </main>
    );
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const focusClassId = typeof resolvedSearchParams?.focusClassId === "string" ? resolvedSearchParams.focusClassId : undefined;

  const [coursesResult, classesResult] = await Promise.all([
    timed("classes.courses", () =>
      listCoursesForUser({
        userId: profileResult.data.id,
        role: profileResult.data.role,
        page: 1,
        pageSize: 100,
      }),
    ),
    timed("classes.list", () =>
      listClassesForUser({
        actorId: profileResult.data.id,
        actorRole: profileResult.data.role,
        page: 1,
        pageSize: 100,
      }),
    ),
  ]);

  if (!coursesResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý lớp</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {coursesResult.error.message}
        </div>
      </main>
    );
  }

  if (!classesResult.ok) {
    return (
      <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">Quản lý lớp</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {classesResult.error.message}
        </div>
      </main>
    );
  }

  const classIds = classesResult.data.items.map((courseClass) => courseClass.id);
  const courseIds = classesResult.data.items.map((courseClass) => courseClass.courseId);
  const visibleCourseIds = coursesResult.data.items.map((course) => course.id);

  const [membersByClassId, enrollmentRequestsResult, classChangeRequestsResult, templatesRaw] = await Promise.all([
    timed("classes.members", () => listClassMembersByClassIdsRepository({ classIds })),
    timed("classes.enrollmentRequests", () => listEnrollmentRequestsByClassIds(classIds)),
    timed(
      "classes.changeRequests",
      () =>
        listClassChangeRequests(
          profileResult.data.role === "teacher"
            ? {
              requestedBy: profileResult.data.id,
              statuses: ["pending_review"],
              actions: ["create"],
            }
            : profileResult.data.role === "moderator"
              ? { courseIds: visibleCourseIds }
              : {},
        ),
    ),
    timed(
      "classes.templates",
      () =>
        listClassTemplatesByCourseIdsRepository(
          courseIds,
          profileResult.data.role === "teacher" ? profileResult.data.id : undefined,
        ),
    ),
  ]);

  const templates = Array.from(new Map(templatesRaw.map((template) => [template.id, template] as const)).values());
  const classChangeRequests = classChangeRequestsResult.ok ? classChangeRequestsResult.data : [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {profileResult.data.role !== "admin" ? (
          <div className="flex flex-wrap gap-4">
            {profileResult.data.role !== "teacher" ? (
              <BackTextLink href="/courses">
                {profileResult.data.role === "moderator" ? "Quay về Quản lý học phần" : "Quay về học phần"}
              </BackTextLink>
            ) : null}
            <BackTextLink href="/dashboard">
              {profileResult.data.role === "teacher"
                ? "Quay về Tổng quan giảng viên"
                : profileResult.data.role === "moderator"
                  ? "Quay về Tổng quan giám sát"
                  : "Quay về bảng điều khiển"}
            </BackTextLink>
          </div>
        ) : (
          <div />
        )}
        {profileResult.data.role === "admin" ? <AdminAreaLink /> : null}
      </div>
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-semibold text-slate-900">
          {profileResult.data.role === "moderator" ? "Giám sát lớp" : "Quản lý lớp"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {profileResult.data.role === "moderator"
            ? "Xem các lớp thuộc học phần được phân quyền và theo dõi yêu cầu tham gia lớp."
            : "Theo dõi lớp, quản lý sinh viên và duyệt yêu cầu tham gia lớp."}
        </p>
      </div>

      <ClassManagementClient
        classes={classesResult.data.items}
        actorRole={profileResult.data.role}
        currentActorId={profileResult.data.id}
        courses={coursesResult.data.items}
        changeRequests={classChangeRequests}
        enrollmentRequests={enrollmentRequestsResult.ok ? enrollmentRequestsResult.data : []}
        templates={templates}
        focusedClassId={focusClassId}
        membersByClassId={membersByClassId}
      />
    </main>
  );
}
