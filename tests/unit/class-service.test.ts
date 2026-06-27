import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createClassMembershipsRepository,
  createClassCreateRequestRepository,
  createClassLifecycleRequestRepository,
  createClassRepository,
  findManageableClassRepository,
  findManageableCourseRepository,
  findStudentProfilesRepository,
  getClassChangeRequestByIdRepository,
  listClassChangeRequestsRepository,
  listClassesForUserRepository,
  listClassMembersRepository,
  listExistingActiveMembershipStudentIdsRepository,
  reviewClassChangeRequestRepository,
} from "@/lib/repositories/class-repository";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import {
  addStudentsToClass,
  createClass,
  importStudentsToClass,
  listClassesForUser,
  listClassMembers,
  reviewClassChangeRequest,
} from "@/lib/services/class-service";

vi.mock("@/lib/repositories/class-repository", () => ({
  createClassMembershipsRepository: vi.fn(),
  createClassCreateRequestRepository: vi.fn(),
  createClassLifecycleRequestRepository: vi.fn(),
  createClassRepository: vi.fn(),
  findManageableClassRepository: vi.fn(),
  findManageableCourseRepository: vi.fn(),
  findStudentProfilesRepository: vi.fn(),
  getClassChangeRequestByIdRepository: vi.fn(),
  listClassChangeRequestsRepository: vi.fn(),
  listClassesForUserRepository: vi.fn(),
  listClassMembersRepository: vi.fn(),
  listExistingActiveMembershipStudentIdsRepository: vi.fn(),
  reviewClassChangeRequestRepository: vi.fn(),
  applyApprovedClassChangeRequestRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/activity-log-repository", () => ({
  createActivityLogRepository: vi.fn(),
}));

const mockedCreateClassMembershipsRepository = vi.mocked(createClassMembershipsRepository);
const mockedCreateClassCreateRequestRepository = vi.mocked(createClassCreateRequestRepository);
const mockedCreateClassLifecycleRequestRepository = vi.mocked(createClassLifecycleRequestRepository);
const mockedCreateClassRepository = vi.mocked(createClassRepository);
const mockedFindManageableClassRepository = vi.mocked(findManageableClassRepository);
const mockedFindManageableCourseRepository = vi.mocked(findManageableCourseRepository);
const mockedFindStudentProfilesRepository = vi.mocked(findStudentProfilesRepository);
const mockedGetClassChangeRequestByIdRepository = vi.mocked(getClassChangeRequestByIdRepository);
const mockedListClassChangeRequestsRepository = vi.mocked(listClassChangeRequestsRepository);
const mockedListClassesForUserRepository = vi.mocked(listClassesForUserRepository);
const mockedListClassMembersRepository = vi.mocked(listClassMembersRepository);
const mockedListExistingActiveMembershipStudentIdsRepository = vi.mocked(listExistingActiveMembershipStudentIdsRepository);
const mockedReviewClassChangeRequestRepository = vi.mocked(reviewClassChangeRequestRepository);
const mockedCreateActivityLogRepository = vi.mocked(createActivityLogRepository);

describe("class-service", () => {
  beforeEach(() => {
    mockedCreateClassMembershipsRepository.mockReset();
    mockedCreateClassCreateRequestRepository.mockReset();
    mockedCreateClassLifecycleRequestRepository.mockReset();
    mockedCreateClassRepository.mockReset();
    mockedFindManageableClassRepository.mockReset();
    mockedFindManageableCourseRepository.mockReset();
    mockedFindStudentProfilesRepository.mockReset();
    mockedGetClassChangeRequestByIdRepository.mockReset();
    mockedListClassChangeRequestsRepository.mockReset();
    mockedListClassesForUserRepository.mockReset();
    mockedListClassMembersRepository.mockReset();
    mockedListExistingActiveMembershipStudentIdsRepository.mockReset();
    mockedReviewClassChangeRequestRepository.mockReset();
    mockedCreateActivityLogRepository.mockReset();
  });

  it("creates a class opening request for a manageable active course", async () => {
    mockedFindManageableCourseRepository.mockResolvedValue({
      id: "course-1",
      ownerId: "teacher-1",
      title: "Course",
      status: "active",
    });
    mockedCreateClassCreateRequestRepository.mockResolvedValue({
      id: "request-1",
      action: "create",
      targetClassId: null,
      courseId: "course-1",
      classCode: "CSE101-A",
      title: "Class A",
      semester: "HK1",
      academicYear: "2026-2027",
      requestedStatus: "active",
      status: "pending_review",
      reason: null,
      reviewNote: null,
      requestedBy: "22222222-2222-4222-8222-222222222222",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await createClass({
      courseId: "11111111-1111-4111-8111-111111111111",
      teacherId: "22222222-2222-4222-8222-222222222222",
      teacherRole: "teacher",
      classCode: "CSE101-A",
      title: "Class A",
      semester: "HK1",
      academicYear: "2026-2027",
      status: "active",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.classCode).toBe("CSE101-A");
      expect(result.data.courseTitle).toBe("Course");
    }
  });

  it("blocks class creation for archived course", async () => {
    mockedFindManageableCourseRepository.mockResolvedValue({
      id: "course-1",
      ownerId: "teacher-1",
      title: "Course",
      status: "archived",
    });

    const result = await createClass({
      courseId: "11111111-1111-4111-8111-111111111111",
      teacherId: "22222222-2222-4222-8222-222222222222",
      teacherRole: "teacher",
      classCode: "CSE101-A",
      title: "Class A",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
    }
  });

  it("returns conflict on duplicate class code", async () => {
    mockedFindManageableCourseRepository.mockResolvedValue({
      id: "course-1",
      ownerId: "teacher-1",
      title: "Course",
      status: "active",
    });
    mockedCreateClassCreateRequestRepository.mockRejectedValue({ code: "23505", message: "duplicate key value" });

    const result = await createClass({
      courseId: "11111111-1111-4111-8111-111111111111",
      teacherId: "22222222-2222-4222-8222-222222222222",
      teacherRole: "teacher",
      classCode: "CSE101-A",
      title: "Class A",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.field).toBe("classCode");
    }
  });

  it("returns forbidden when admin tries to create a class directly", async () => {
    const result = await createClass({
      courseId: "11111111-1111-4111-8111-111111111111",
      teacherId: "22222222-2222-4222-8222-222222222222",
      teacherRole: "admin",
      classCode: "CSE101-A",
      title: "Class A",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("adds student memberships while skipping missing and duplicate records", async () => {
    mockedFindManageableClassRepository.mockResolvedValue({
      id: "class-1",
      courseId: "course-1",
      teacherId: "teacher-1",
      title: "Class A",
      status: "active",
    });
    mockedFindStudentProfilesRepository.mockResolvedValue([
      {
        id: "student-1",
        email: "student1@local.test",
        fullName: "Student One",
        studentCode: "SV001",
      },
      {
        id: "student-2",
        email: "student2@local.test",
        fullName: "Student Two",
        studentCode: "SV002",
      },
    ]);
    mockedListExistingActiveMembershipStudentIdsRepository.mockResolvedValue(new Set(["student-2"]));
    mockedCreateClassMembershipsRepository.mockResolvedValue(1);

    const result = await addStudentsToClass({
      classId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      students: [
        { email: "student1@local.test", fullName: "Student One" },
        { email: "student2@local.test", fullName: "Student Two" },
        { email: "missing@local.test", fullName: "Missing Student" },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.added).toBe(1);
      expect(result.data.skipped).toBe(2);
      expect(result.data.needsReview).toHaveLength(2);
    }
  });

  it("imports students from csv and reuses duplicate detection rules", async () => {
    mockedFindManageableClassRepository.mockResolvedValue({
      id: "class-1",
      courseId: "course-1",
      teacherId: "teacher-1",
      title: "Class A",
      status: "active",
    });
    mockedFindStudentProfilesRepository.mockResolvedValue([
      {
        id: "student-1",
        email: "student1@local.test",
        fullName: "Student One",
        studentCode: "SV001",
      },
      {
        id: "student-2",
        email: "student2@local.test",
        fullName: "Student Two",
        studentCode: "SV002",
      },
    ]);
    mockedListExistingActiveMembershipStudentIdsRepository.mockResolvedValue(new Set(["student-2"]));
    mockedCreateClassMembershipsRepository.mockResolvedValue(1);

    const result = await importStudentsToClass({
      classId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      csvContent: "fullName,email,studentCode\nStudent One,student1@local.test,SV001\nStudent Two,student2@local.test,SV002\n",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.added).toBe(1);
      expect(result.data.skipped).toBe(1);
      expect(result.data.needsReview[0]?.reason).toContain("membership active");
    }

    expect(mockedCreateActivityLogRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "class.members.import_csv",
        entityType: "class",
      }),
    );
  });

  it("rejects csv imports without supported identifier headers", async () => {
    const result = await importStudentsToClass({
      classId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      csvContent: "fullName\nStudent One\n",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("lists student classes by membership", async () => {
    mockedListClassesForUserRepository.mockResolvedValue({
      items: [
        {
          id: "class-1",
          courseId: "course-1",
          teacherId: "teacher-1",
          courseCode: "CSE101",
          courseTitle: "Course",
          classCode: "CSE101-A",
          title: "Class A",
          semester: null,
          academicYear: null,
          status: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      totalItems: 1,
    });

    const result = await listClassesForUser({
      actorId: "33333333-3333-4333-8333-333333333333",
      actorRole: "student",
      page: 1,
      pageSize: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.title).toBe("Class A");
    }
  });

  it("lists class members for teacher", async () => {
    mockedListClassMembersRepository.mockResolvedValue({
      items: [
        {
          id: "member-1",
          classId: "class-1",
          studentId: "student-1",
          email: "student1@local.test",
          fullName: "Student One",
          studentCode: "SV001",
          status: "active",
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      totalItems: 1,
    });

    const result = await listClassMembers({
      classId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
      page: 1,
      pageSize: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0]?.email).toBe("student1@local.test");
    }
  });

  it("allows admin to approve a class opening request", async () => {
    mockedGetClassChangeRequestByIdRepository.mockResolvedValue({
      id: "request-1",
      action: "create",
      targetClassId: null,
      courseId: "course-1",
      classCode: "CSE101-A",
      title: "Class A",
      semester: "HK1",
      academicYear: "2026-2027",
      requestedStatus: "active",
      status: "pending_review",
      reason: null,
      reviewNote: null,
      requestedBy: "teacher-1",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mockedReviewClassChangeRequestRepository.mockResolvedValue({
      id: "request-1",
      action: "create",
      targetClassId: null,
      courseId: "course-1",
      classCode: "CSE101-A",
      title: "Class A",
      semester: "HK1",
      academicYear: "2026-2027",
      requestedStatus: "active",
      status: "approved",
      reason: null,
      reviewNote: "OK",
      requestedBy: "teacher-1",
      reviewedBy: "admin-1",
      reviewedAt: "2026-01-02T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await reviewClassChangeRequest({
      requestId: "request-1",
      actorId: "admin-1",
      actorRole: "admin",
      decision: "approved",
      note: "OK",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("approved");
    }
    expect(mockedReviewClassChangeRequestRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "request-1",
        reviewedBy: "admin-1",
        status: "approved",
      }),
    );
  });
});
