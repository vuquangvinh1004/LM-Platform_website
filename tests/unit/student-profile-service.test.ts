import { beforeEach, describe, expect, it, vi } from "vitest";

import { getStudentProfileOverviewRepository } from "@/lib/repositories/student-profile-repository";
import { getStudentProfileOverview } from "@/lib/services/student-profile-service";

vi.mock("@/lib/repositories/student-profile-repository", () => ({
  getStudentProfileOverviewRepository: vi.fn(),
}));

const mockedGetStudentProfileOverviewRepository = vi.mocked(getStudentProfileOverviewRepository);

describe("student-profile-service", () => {
  beforeEach(() => {
    mockedGetStudentProfileOverviewRepository.mockReset();
  });

  it("returns validation error for invalid input", async () => {
    const result = await getStudentProfileOverview({
      studentId: "invalid-id",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "teacher",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("blocks student from reading another student's profile", async () => {
    const result = await getStudentProfileOverview({
      studentId: "11111111-1111-4111-8111-111111111111",
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "student",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockedGetStudentProfileOverviewRepository).not.toHaveBeenCalled();
  });

  it("returns not found when repository has no profile", async () => {
    mockedGetStudentProfileOverviewRepository.mockResolvedValue(null);

    const result = await getStudentProfileOverview({
      studentId: "33333333-3333-4333-8333-333333333333",
      actorId: "44444444-4444-4444-8444-444444444444",
      actorRole: "teacher",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns profile overview for allowed actor", async () => {
    mockedGetStudentProfileOverviewRepository.mockResolvedValue({
      personalInfo: {
        fullName: "Student One",
        studentCode: "SV001",
      },
      access: {
        accessStatus: "active",
      },
      summary: {
        totalAssessments: 4,
        completedAssessments: 3,
      },
      courseBreakdown: [],
      badges: [],
    });

    const result = await getStudentProfileOverview({
      studentId: "55555555-5555-4555-8555-555555555555",
      actorId: "66666666-6666-4666-8666-666666666666",
      actorRole: "admin",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.personalInfo.fullName).toBe("Student One");
      expect(result.data.summary.totalAssessments).toBe(4);
    }
  });
});
