import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createClassAnnouncementRepository,
  getClassroomClassInfoRepository,
} from "@/lib/repositories/classroom-repository";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import { buildDeterministicClassroomSeats, createClassAnnouncement } from "@/lib/services/classroom-service";

vi.mock("@/lib/repositories/classroom-repository", () => ({
  createClassAnnouncementRepository: vi.fn(),
  getClassroomClassInfoRepository: vi.fn(),
  listActiveClassMembersRepository: vi.fn(),
  listClassAnnouncementsRepository: vi.fn(),
  listClassroomMaterialsRepository: vi.fn(),
  listClassroomSimulationsRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/activity-log-repository", () => ({
  createActivityLogRepository: vi.fn(),
}));

const mockedCreateClassAnnouncementRepository = vi.mocked(createClassAnnouncementRepository);
const mockedGetClassroomClassInfoRepository = vi.mocked(getClassroomClassInfoRepository);
const mockedCreateActivityLogRepository = vi.mocked(createActivityLogRepository);

describe("classroom-service", () => {
  beforeEach(() => {
    mockedCreateClassAnnouncementRepository.mockReset();
    mockedGetClassroomClassInfoRepository.mockReset();
    mockedCreateActivityLogRepository.mockReset();
  });

  it("builds deterministic seat order by normalized fullName", () => {
    const seats = buildDeterministicClassroomSeats([
      {
        id: "member-3",
        studentId: "student-3",
        fullName: "  Nguyen Van C  ",
        studentCode: "SV003",
      },
      {
        id: "member-1",
        studentId: "student-1",
        fullName: "an  nguyen",
        studentCode: "SV001",
      },
      {
        id: "member-2",
        studentId: "student-2",
        fullName: "Binh Tran",
        studentCode: "SV002",
      },
    ]);

    expect(seats.map((seat) => seat.fullName)).toEqual(["an  nguyen", "Binh Tran", "  Nguyen Van C  "]);
    expect(seats.map((seat) => seat.seatOrder)).toEqual([1, 2, 3]);
    expect(seats.map((seat) => `${seat.row}-${seat.column}`)).toEqual(["1-1", "1-2", "1-3"]);
  });

  it("returns forbidden when student tries to create class announcement", async () => {
    const result = await createClassAnnouncement({
      classId: "91e5f8f6-9d30-4e80-878f-55bb9f27d286",
      actorId: "89f1d9f2-6f1d-4f4f-8f37-262f7f02f6d8",
      actorRole: "student",
      title: "Thong bao",
      content: "Noi dung",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
  });

  it("creates announcement for teacher and writes activity log", async () => {
    mockedGetClassroomClassInfoRepository.mockResolvedValueOnce({
      id: "class-1",
      courseId: "course-1",
      classCode: "CLS-001",
      classTitle: "Class One",
      courseCode: "CSE101",
      courseTitle: "Course",
      teacherId: "teacher-1",
      teacherName: "Teacher One",
      teacherEmail: "teacher1@local.test",
      teacherDeskNote: null,
    });
    mockedCreateClassAnnouncementRepository.mockResolvedValueOnce({
      id: "announcement-1",
      classId: "class-1",
      title: "Thong bao",
      content: "Noi dung",
      status: "published",
      createdAt: new Date().toISOString(),
    });

    const result = await createClassAnnouncement({
      classId: "91e5f8f6-9d30-4e80-878f-55bb9f27d286",
      actorId: "89f1d9f2-6f1d-4f4f-8f37-262f7f02f6d8",
      actorRole: "teacher",
      title: "Thong bao",
      content: "Noi dung",
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateActivityLogRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "class.announcement.created",
        entityType: "class",
      }),
    );
  });
});
