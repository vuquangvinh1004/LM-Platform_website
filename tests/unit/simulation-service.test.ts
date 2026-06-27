import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  findCourseForSimulationRepository,
  listSimulationsForCourseRepository,
} from "@/lib/repositories/simulation-repository";
import { listSimulationsForCourse } from "@/lib/services/simulation-service";

vi.mock("@/lib/repositories/simulation-repository", () => ({
  findCourseForSimulationRepository: vi.fn(),
  listSimulationsForCourseRepository: vi.fn(),
}));

const mockedFindCourseForSimulationRepository = vi.mocked(findCourseForSimulationRepository);
const mockedListSimulationsForCourseRepository = vi.mocked(listSimulationsForCourseRepository);

describe("simulation-service", () => {
  beforeEach(() => {
    mockedFindCourseForSimulationRepository.mockReset();
    mockedListSimulationsForCourseRepository.mockReset();
  });

  it("returns course simulations when repository succeeds", async () => {
    mockedFindCourseForSimulationRepository.mockResolvedValueOnce({
      id: "course-1",
      title: "Course",
    });
    mockedListSimulationsForCourseRepository.mockResolvedValueOnce([
      {
        id: "sim-1",
        courseId: "course-1",
        slug: "moving-average-basic",
        title: "MA",
        description: "desc",
        sortOrder: 0,
        status: "published",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const result = await listSimulationsForCourse({
      courseId: "91e5f8f6-9d30-4e80-878f-55bb9f27d286",
      actorId: "89f1d9f2-6f1d-4f4f-8f37-262f7f02f6d8",
      actorRole: "teacher",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
    }
  });

  it("returns not found when course is not visible", async () => {
    mockedFindCourseForSimulationRepository.mockResolvedValueOnce(null);

    const result = await listSimulationsForCourse({
      courseId: "91e5f8f6-9d30-4e80-878f-55bb9f27d286",
      actorId: "89f1d9f2-6f1d-4f4f-8f37-262f7f02f6d8",
      actorRole: "teacher",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
