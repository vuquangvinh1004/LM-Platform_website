import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createClassDirectMessageRepository,
  findClassForMessageRepository,
  isActiveMemberOfClassRepository,
} from "@/lib/repositories/message-repository";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";
import { sendClassDirectMessage } from "@/lib/services/message-service";

vi.mock("@/lib/repositories/message-repository", () => ({
  createClassDirectMessageRepository: vi.fn(),
  findClassForMessageRepository: vi.fn(),
  isActiveMemberOfClassRepository: vi.fn(),
}));

vi.mock("@/lib/repositories/activity-log-repository", () => ({
  createActivityLogRepository: vi.fn(),
}));

const mockedCreateClassDirectMessageRepository = vi.mocked(createClassDirectMessageRepository);
const mockedFindClassForMessageRepository = vi.mocked(findClassForMessageRepository);
const mockedIsActiveMemberOfClassRepository = vi.mocked(isActiveMemberOfClassRepository);
const mockedCreateActivityLogRepository = vi.mocked(createActivityLogRepository);

describe("message-service", () => {
  beforeEach(() => {
    mockedCreateClassDirectMessageRepository.mockReset();
    mockedFindClassForMessageRepository.mockReset();
    mockedIsActiveMemberOfClassRepository.mockReset();
    mockedCreateActivityLogRepository.mockReset();
  });

  it("blocks student from messaging non-teacher recipient", async () => {
    mockedFindClassForMessageRepository.mockResolvedValueOnce({
      id: "class-1",
      teacherId: "teacher-1",
    });
    mockedIsActiveMemberOfClassRepository.mockResolvedValueOnce(true);

    const result = await sendClassDirectMessage({
      classId: "91e5f8f6-9d30-4e80-878f-55bb9f27d286",
      actorId: "89f1d9f2-6f1d-4f4f-8f37-262f7f02f6d8",
      actorRole: "student",
      recipientId: "257a1d8a-1400-4ad6-92b8-b3ef166f0db2",
      content: "Xin chao",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("FORBIDDEN");
    }
    expect(mockedCreateClassDirectMessageRepository).not.toHaveBeenCalled();
  });

  it("sends message for teacher role when class exists", async () => {
    mockedFindClassForMessageRepository.mockResolvedValueOnce({
      id: "class-1",
      teacherId: "teacher-1",
    });
    mockedCreateClassDirectMessageRepository.mockResolvedValueOnce({
      id: "message-1",
      classId: "class-1",
      senderId: "teacher-1",
      recipientId: "student-1",
      content: "Thong bao",
      createdAt: new Date().toISOString(),
      readAt: null,
    });

    const result = await sendClassDirectMessage({
      classId: "91e5f8f6-9d30-4e80-878f-55bb9f27d286",
      actorId: "89f1d9f2-6f1d-4f4f-8f37-262f7f02f6d8",
      actorRole: "teacher",
      recipientId: "257a1d8a-1400-4ad6-92b8-b3ef166f0db2",
      content: "Thong bao",
    });

    expect(result.ok).toBe(true);
    expect(mockedCreateClassDirectMessageRepository).toHaveBeenCalledTimes(1);
    expect(mockedCreateActivityLogRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "class.direct_message.sent",
        entityType: "class",
      }),
    );
  });
});
