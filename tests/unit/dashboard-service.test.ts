import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTeacherDashboardRepository } from "@/lib/repositories/dashboard-repository";
import { getTeacherDashboard } from "@/lib/services/dashboard-service";

vi.mock("@/lib/repositories/dashboard-repository", () => ({
  getTeacherDashboardRepository: vi.fn(),
}));

const mockedGetTeacherDashboardRepository = vi.mocked(getTeacherDashboardRepository);

describe("dashboard-service", () => {
  beforeEach(() => {
    mockedGetTeacherDashboardRepository.mockReset();
  });

  it("returns dashboard metrics when repository succeeds", async () => {
    mockedGetTeacherDashboardRepository.mockResolvedValueOnce({
      totalCourses: 2,
      totalClasses: 3,
      totalStudents: 20,
      totalAssessments: 5,
      completionRate: 75,
      completionSeries: [
        {
          assessmentId: "assessment-1",
          assessmentTitle: "Quiz 1",
          classId: "class-1",
          completionRate: 80,
          completedCount: 16,
          expectedCount: 20,
          averageScore: 78,
        },
      ],
      recentActivities: [
        {
          id: "activity-1",
          action: "submission.import.completed",
          entityType: "import_job",
          entityId: "job-1",
          createdAt: "2026-05-28T00:00:00.000Z",
          metadata: { importedCount: 16 },
        },
      ],
      studentMessageNotices: [],
      selectedCourseId: undefined,
      selectedClassId: undefined,
      courses: [
        {
          id: "course-1",
          code: "C001",
          title: "Course 1",
        },
      ],
      classes: [
        {
          id: "class-1",
          classCode: "L01",
          title: "Class 1",
          courseId: "course-1",
        },
      ],
    });

    const result = await getTeacherDashboard();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.totalCourses).toBe(2);
      expect(result.data.completionSeries).toHaveLength(1);
    }
  });

  it("passes filter input to repository for filtered dashboard", async () => {
    mockedGetTeacherDashboardRepository.mockResolvedValueOnce({
      totalCourses: 1,
      totalClasses: 1,
      totalStudents: 10,
      totalAssessments: 2,
      completionRate: 60,
      completionSeries: [],
      recentActivities: [],
      studentMessageNotices: [],
      selectedCourseId: "course-1",
      selectedClassId: "class-1",
      courses: [
        {
          id: "course-1",
          code: "C001",
          title: "Course 1",
        },
      ],
      classes: [
        {
          id: "class-1",
          classCode: "L01",
          title: "Class 1",
          courseId: "course-1",
        },
      ],
    });

    const result = await getTeacherDashboard({
      courseId: "course-1",
      classId: "class-1",
    });

    expect(mockedGetTeacherDashboardRepository).toHaveBeenCalledWith({
      courseId: "course-1",
      classId: "class-1",
    });
    expect(result.ok).toBe(true);
  });

  it("returns structured unknown error when repository throws", async () => {
    mockedGetTeacherDashboardRepository.mockRejectedValueOnce(new Error("db unavailable"));

    const result = await getTeacherDashboard();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_ERROR");
      expect(result.error.message).toBe("Không thể tải dashboard giảng viên.");
    }
  });
});
