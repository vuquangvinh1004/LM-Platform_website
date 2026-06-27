import { beforeEach, describe, expect, it, vi } from "vitest";

import { archiveCourse, assignCourseTeachers, createCourse, deleteCourse, listCoursesForUser, updateCourse } from "@/lib/services/course-service";
import {
  archiveCourseRepository,
  applyApprovedCourseChangeRequestRepository,
  assignCourseTeachersRepository,
  createCourseChangeRequestRepository,
  createCourseCreateRequestRepository,
  createCourseUpdateRequestRepository,
  createCourseRepository,
  deleteCourseRepository,
  getCourseDeletionBlockersRepository,
  getCourseByIdRepository,
  getCourseChangeRequestByIdRepository,
  listActiveTeachersRepository,
  listCourseChangeRequestsRepository,
  listCoursesForUserRepository,
  reviewCourseChangeRequestRepository,
  seedDefaultSimulationWidgetsForCourseRepository,
  updateCourseRepository,
} from "@/lib/repositories/course-repository";

vi.mock("@/lib/repositories/course-repository", () => ({
  archiveCourseRepository: vi.fn(),
  applyApprovedCourseChangeRequestRepository: vi.fn(),
  assignCourseTeachersRepository: vi.fn(),
  createCourseChangeRequestRepository: vi.fn(),
  createCourseCreateRequestRepository: vi.fn(),
  createCourseUpdateRequestRepository: vi.fn(),
  createCourseRepository: vi.fn(),
  deleteCourseRepository: vi.fn(),
  getCourseDeletionBlockersRepository: vi.fn(),
  getCourseByIdRepository: vi.fn(),
  getCourseChangeRequestByIdRepository: vi.fn(),
  listActiveTeachersRepository: vi.fn(),
  listCourseChangeRequestsRepository: vi.fn(),
  listCoursesForUserRepository: vi.fn(),
  reviewCourseChangeRequestRepository: vi.fn(),
  seedDefaultSimulationWidgetsForCourseRepository: vi.fn(),
  updateCourseRepository: vi.fn(),
}));

const mockedArchiveCourseRepository = vi.mocked(archiveCourseRepository);
const mockedApplyApprovedCourseChangeRequestRepository = vi.mocked(applyApprovedCourseChangeRequestRepository);
const mockedAssignCourseTeachersRepository = vi.mocked(assignCourseTeachersRepository);
const mockedCreateCourseChangeRequestRepository = vi.mocked(createCourseChangeRequestRepository);
const mockedCreateCourseCreateRequestRepository = vi.mocked(createCourseCreateRequestRepository);
const mockedCreateCourseUpdateRequestRepository = vi.mocked(createCourseUpdateRequestRepository);
const mockedCreateCourseRepository = vi.mocked(createCourseRepository);
const mockedDeleteCourseRepository = vi.mocked(deleteCourseRepository);
const mockedGetCourseDeletionBlockersRepository = vi.mocked(getCourseDeletionBlockersRepository);
const mockedGetCourseByIdRepository = vi.mocked(getCourseByIdRepository);
const mockedGetCourseChangeRequestByIdRepository = vi.mocked(getCourseChangeRequestByIdRepository);
const mockedListActiveTeachersRepository = vi.mocked(listActiveTeachersRepository);
const mockedListCourseChangeRequestsRepository = vi.mocked(listCourseChangeRequestsRepository);
const mockedListCoursesForUserRepository = vi.mocked(listCoursesForUserRepository);
const mockedReviewCourseChangeRequestRepository = vi.mocked(reviewCourseChangeRequestRepository);
const mockedSeedDefaultSimulationWidgetsForCourseRepository = vi.mocked(seedDefaultSimulationWidgetsForCourseRepository);
const mockedUpdateCourseRepository = vi.mocked(updateCourseRepository);

describe("course-service", () => {
  beforeEach(() => {
    mockedArchiveCourseRepository.mockReset();
    mockedApplyApprovedCourseChangeRequestRepository.mockReset();
    mockedAssignCourseTeachersRepository.mockReset();
    mockedCreateCourseChangeRequestRepository.mockReset();
    mockedCreateCourseCreateRequestRepository.mockReset();
    mockedCreateCourseUpdateRequestRepository.mockReset();
    mockedCreateCourseRepository.mockReset();
    mockedDeleteCourseRepository.mockReset();
    mockedGetCourseDeletionBlockersRepository.mockReset();
    mockedGetCourseByIdRepository.mockReset();
    mockedGetCourseChangeRequestByIdRepository.mockReset();
    mockedListActiveTeachersRepository.mockReset();
    mockedListCourseChangeRequestsRepository.mockReset();
    mockedListCoursesForUserRepository.mockReset();
    mockedReviewCourseChangeRequestRepository.mockReset();
    mockedSeedDefaultSimulationWidgetsForCourseRepository.mockReset();
    mockedUpdateCourseRepository.mockReset();
  });

  it("returns validation error for invalid pagination", async () => {
    const result = await listCoursesForUser({
      userId: "11111111-1111-4111-8111-111111111111",
      role: "teacher",
      page: 0,
      pageSize: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns empty result for student role", async () => {
    const result = await listCoursesForUser({
      userId: "22222222-2222-4222-8222-222222222222",
      role: "student",
      page: 1,
      pageSize: 10,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toEqual([]);
      expect(result.data.totalItems).toBe(0);
      expect(result.data.totalPages).toBe(0);
    }
    expect(mockedListCoursesForUserRepository).not.toHaveBeenCalled();
  });

  it("filters by owner for teacher through repository input", async () => {
    mockedListCoursesForUserRepository.mockResolvedValue({
      items: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          ownerId: "33333333-3333-4333-8333-333333333333",
          ownerFullName: "Teacher Demo",
          ownerRole: "teacher",
          code: "MATH101",
          title: "Math 101",
          description: null,
          visibility: "private",
          status: "active",
          credits: null,
          knowledgeBlock: null,
          courseType: null,
          cloItems: [],
          assessmentComponents: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      totalItems: 1,
    });

    const result = await listCoursesForUser({
      userId: "33333333-3333-4333-8333-333333333333",
      role: "teacher",
      page: 1,
      pageSize: 10,
      query: "math",
      status: "active",
    });

    expect(mockedListCoursesForUserRepository).toHaveBeenCalledWith({
      userId: "33333333-3333-4333-8333-333333333333",
      role: "teacher",
      page: 1,
      pageSize: 10,
      query: "math",
      status: "active",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items.length).toBe(1);
      expect(result.data.totalItems).toBe(1);
      expect(result.data.totalPages).toBe(1);
    }
  });

  it("maps repository failures to unknown error", async () => {
    mockedListCoursesForUserRepository.mockRejectedValue(new Error("db failed"));

    const result = await listCoursesForUser({
      userId: "44444444-4444-4444-8444-444444444444",
      role: "admin",
      page: 1,
      pageSize: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_ERROR");
    }
  });

  it("creates course with default visibility", async () => {
    mockedCreateCourseRepository.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ownerFullName: "Admin Demo",
      ownerRole: "admin",
      code: "PHY101",
      title: "Physics 101",
      description: null,
      visibility: "private",
      status: "draft",
      credits: null,
      knowledgeBlock: null,
      courseType: null,
      cloItems: [],
      assessmentComponents: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockedSeedDefaultSimulationWidgetsForCourseRepository.mockResolvedValue();

    const result = await createCourse({
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "admin",
      code: "PHY101",
      title: "Physics 101",
    });

    expect(mockedCreateCourseRepository).toHaveBeenCalledWith({
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "admin",
      code: "PHY101",
      title: "Physics 101",
      visibility: "private",
      status: "draft",
      assignedTeacherIds: [],
      cloItems: [],
      assessmentComponents: [],
    });
    expect(mockedAssignCourseTeachersRepository).toHaveBeenCalledWith({
      courseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      teacherIds: [],
      grantedBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(mockedSeedDefaultSimulationWidgetsForCourseRepository).toHaveBeenCalledWith("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(result.ok).toBe(true);
  });

  it("allows admin to create course with selected status", async () => {
    mockedCreateCourseRepository.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ownerFullName: "Admin Demo",
      ownerRole: "admin",
      code: "PHY102",
      title: "Physics 102",
      description: null,
      visibility: "private",
      status: "active",
      credits: null,
      knowledgeBlock: null,
      courseType: null,
      cloItems: [],
      assessmentComponents: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockedSeedDefaultSimulationWidgetsForCourseRepository.mockResolvedValue();

    const result = await createCourse({
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "admin",
      code: "PHY102",
      title: "Physics 102",
      status: "active",
    });

    expect(mockedCreateCourseRepository).toHaveBeenCalledWith({
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "admin",
      code: "PHY102",
      title: "Physics 102",
      visibility: "private",
      status: "active",
      assignedTeacherIds: [],
      cloItems: [],
      assessmentComponents: [],
    });
    expect(result.ok).toBe(true);
  });

  it("assigns selected teachers when admin creates a course", async () => {
    mockedCreateCourseRepository.mockResolvedValue({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      ownerFullName: "Admin Demo",
      ownerRole: "admin",
      code: "PHY103",
      title: "Physics 103",
      description: null,
      visibility: "private",
      status: "active",
      credits: null,
      knowledgeBlock: null,
      courseType: null,
      cloItems: [],
      assessmentComponents: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockedSeedDefaultSimulationWidgetsForCourseRepository.mockResolvedValue();

    const result = await createCourse({
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "admin",
      code: "PHY103",
      title: "Physics 103",
      status: "active",
      assignedTeacherIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
    });

    expect(mockedAssignCourseTeachersRepository).toHaveBeenCalledWith({
      courseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      teacherIds: [
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      grantedBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(result.ok).toBe(true);
  });

  it("maps duplicate course code to conflict", async () => {
    mockedCreateCourseRepository.mockRejectedValue(new Error("duplicate key value violates unique constraint"));

    const result = await createCourse({
      ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      actorRole: "admin",
      code: "PHY101",
      title: "Physics 101",
      visibility: "private",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.field).toBe("code");
    }
  });

  it("returns forbidden when non-teacher role attempts update", async () => {
    const result = await updateCourse({
      courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "student",
      title: "Updated title",
      visibility: "private",
      status: "draft",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockedUpdateCourseRepository).not.toHaveBeenCalled();
  });

  it("returns not found when update repository has no row", async () => {
    mockedUpdateCourseRepository.mockResolvedValue(null);

    const result = await updateCourse({
      courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      actorId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      actorRole: "teacher",
      title: "Updated title",
      visibility: "private",
      status: "draft",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("stores requested status when admin edits a moderator-managed course", async () => {
    mockedGetCourseByIdRepository.mockResolvedValue({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      ownerId: "mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm",
      ownerFullName: "Moderator Demo",
      ownerRole: "moderator",
      code: "BA59013",
      title: "Old title",
      description: "Old description",
      visibility: "private",
      status: "draft",
      credits: 3,
      knowledgeBlock: "major",
      courseType: "required",
      cloItems: [],
      assessmentComponents: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mockedCreateCourseUpdateRequestRepository.mockResolvedValue({
      id: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr",
      action: "update",
      targetCourseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      targetCodeSnapshot: "BA59013",
      targetTitleSnapshot: "Old title",
      requestedCode: null,
      requestedTitle: "New title",
      requestedDescription: "New description",
      requestedVisibility: "private",
      requestedStatus: "active",
      requestedCredits: 3,
      requestedKnowledgeBlock: "major",
      requestedCourseType: "required",
      requestedCloItems: [],
      requestedAssessmentComponents: [],
      assignedModeratorId: "mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm",
      status: "pending_review",
      reason: "Admin đề nghị chỉnh sửa học phần đã giao Mod quản lý.",
      reviewNote: null,
      requestedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      reviewedBy: null,
      reviewedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await updateCourse({
      courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorRole: "admin",
      title: "New title",
      description: "New description",
      visibility: "private",
      status: "active",
      credits: 3,
      knowledgeBlock: "major",
      courseType: "required",
      cloItems: [],
      assessmentComponents: [],
    });

    expect(mockedCreateCourseUpdateRequestRepository).toHaveBeenCalledWith({
      targetCourseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      requestedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      assignedModeratorId: "mmmmmmmm-mmmm-4mmm-8mmm-mmmmmmmmmmmm",
      codeSnapshot: "BA59013",
      titleSnapshot: "Old title",
      title: "New title",
      description: "New description",
      visibility: "private",
      status: "active",
      credits: 3,
      knowledgeBlock: "major",
      courseType: "required",
      cloItems: [],
      assessmentComponents: [],
    });
    expect(result.ok).toBe(true);
  });

  it("archives course successfully for admin", async () => {
    mockedArchiveCourseRepository.mockResolvedValue(true);

    const result = await archiveCourse({
      courseId: "99999999-9999-4999-8999-999999999999",
      actorId: "88888888-8888-4888-8888-888888888888",
      actorRole: "admin",
    });

    expect(mockedArchiveCourseRepository).toHaveBeenCalledWith({
      courseId: "99999999-9999-4999-8999-999999999999",
      actorId: "88888888-8888-4888-8888-888888888888",
      actorRole: "admin",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects archive request for non-authorized role", async () => {
    const result = await archiveCourse({
      courseId: "99999999-9999-4999-8999-999999999999",
      actorId: "88888888-8888-4888-8888-888888888888",
      actorRole: "student",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockedArchiveCourseRepository).not.toHaveBeenCalled();
  });

  it("blocks admin delete when course still has classes or materials", async () => {
    mockedGetCourseDeletionBlockersRepository.mockResolvedValue({
      classCount: 1,
      materialCount: 2,
    });

    const result = await deleteCourse({
      courseId: "77777777-7777-4777-8777-777777777777",
      actorId: "88888888-8888-4888-8888-888888888888",
      actorRole: "admin",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONFLICT");
      expect(result.error.message).toContain("1 lớp học phần");
      expect(result.error.message).toContain("2 tài liệu");
    }
    expect(mockedDeleteCourseRepository).not.toHaveBeenCalled();
  });

  it("deletes course for admin after dependency check passes", async () => {
    mockedGetCourseDeletionBlockersRepository.mockResolvedValue({
      classCount: 0,
      materialCount: 0,
    });
    mockedDeleteCourseRepository.mockResolvedValue(true);

    const result = await deleteCourse({
      courseId: "77777777-7777-4777-8777-777777777777",
      actorId: "88888888-8888-4888-8888-888888888888",
      actorRole: "admin",
    });

    expect(mockedGetCourseDeletionBlockersRepository).toHaveBeenCalledWith("77777777-7777-4777-8777-777777777777");
    expect(mockedDeleteCourseRepository).toHaveBeenCalledWith({
      courseId: "77777777-7777-4777-8777-777777777777",
    });
    expect(result.ok).toBe(true);
  });

  it("assigns active teachers to a course for admin", async () => {
    mockedListActiveTeachersRepository.mockResolvedValue([
      {
        id: "11111111-1111-4111-8111-111111111111",
        fullName: "Teacher A",
        email: "teacher-a@local.test",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        fullName: "Teacher B",
        email: "teacher-b@local.test",
      },
    ]);
    mockedGetCourseByIdRepository
      .mockResolvedValueOnce({
        id: "77777777-7777-4777-8777-777777777777",
        ownerId: "33333333-3333-4333-8333-333333333333",
        ownerFullName: "Moderator Demo",
        ownerRole: "moderator",
        code: "BA59013",
        title: "Course A",
        description: null,
        visibility: "private",
        status: "active",
        credits: null,
        knowledgeBlock: null,
        courseType: null,
        cloItems: [],
        assessmentComponents: [],
        assignedTeachers: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      })
      .mockResolvedValueOnce({
        id: "77777777-7777-4777-8777-777777777777",
        ownerId: "33333333-3333-4333-8333-333333333333",
        ownerFullName: "Moderator Demo",
        ownerRole: "moderator",
        code: "BA59013",
        title: "Course A",
        description: null,
        visibility: "private",
        status: "active",
        credits: null,
        knowledgeBlock: null,
        courseType: null,
        cloItems: [],
        assessmentComponents: [],
        assignedTeachers: [
          { id: "11111111-1111-4111-8111-111111111111", fullName: "Teacher A", email: "teacher-a@local.test" },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });

    const result = await assignCourseTeachers({
      courseId: "77777777-7777-4777-8777-777777777777",
      teacherIds: ["11111111-1111-4111-8111-111111111111"],
      actorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actorRole: "admin",
    });

    expect(mockedAssignCourseTeachersRepository).toHaveBeenCalledWith({
      courseId: "77777777-7777-4777-8777-777777777777",
      teacherIds: ["11111111-1111-4111-8111-111111111111"],
      grantedBy: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(result.ok).toBe(true);
  });
});
