import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveStudentAccessRepository,
  checkScopedPermissionRepository,
  renewStudentAccessRepository,
} from "@/lib/repositories/access-control-repository";
import {
  approveStudentAccess,
  checkScopedPermission,
  renewStudentAccess,
} from "@/lib/services/access-control-service";

vi.mock("@/lib/repositories/access-control-repository", () => ({
  approveStudentAccessRepository: vi.fn(),
  checkScopedPermissionRepository: vi.fn(),
  renewStudentAccessRepository: vi.fn(),
}));

const mockedApproveStudentAccessRepository = vi.mocked(approveStudentAccessRepository);
const mockedCheckScopedPermissionRepository = vi.mocked(checkScopedPermissionRepository);
const mockedRenewStudentAccessRepository = vi.mocked(renewStudentAccessRepository);

describe("access-control-service", () => {
  beforeEach(() => {
    mockedApproveStudentAccessRepository.mockReset();
    mockedCheckScopedPermissionRepository.mockReset();
    mockedRenewStudentAccessRepository.mockReset();
  });

  it("returns validation error for invalid scope permission payload", async () => {
    const result = await checkScopedPermission({
      actorId: "not-a-uuid",
      actorRole: "teacher",
      resourceType: "course",
      resourceId: "11111111-1111-4111-8111-111111111111",
      permission: "manage_course",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
    expect(mockedCheckScopedPermissionRepository).not.toHaveBeenCalled();
  });

  it("returns allowed false with reason from scope check", async () => {
    mockedCheckScopedPermissionRepository.mockResolvedValue(false);

    const result = await checkScopedPermission({
      actorId: "22222222-2222-4222-8222-222222222222",
      actorRole: "moderator",
      resourceType: "class",
      resourceId: "33333333-3333-4333-8333-333333333333",
      permission: "manage_members",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.allowed).toBe(false);
      expect(result.data.reason).toContain("phạm vi quyền");
    }
  });

  it("approves student access successfully", async () => {
    mockedApproveStudentAccessRepository.mockResolvedValue();

    const result = await approveStudentAccess({
      studentId: "44444444-4444-4444-8444-444444444444",
      actorId: "55555555-5555-4555-8555-555555555555",
      actorRole: "admin",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });

    expect(mockedApproveStudentAccessRepository).toHaveBeenCalledWith({
      studentId: "44444444-4444-4444-8444-444444444444",
      actorId: "55555555-5555-4555-8555-555555555555",
      expiresAt: "2027-01-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.accessStatus).toBe("active");
    }
  });

  it("maps renew repository failure to unknown error", async () => {
    mockedRenewStudentAccessRepository.mockRejectedValue(new Error("db failed"));

    const result = await renewStudentAccess({
      studentId: "66666666-6666-4666-8666-666666666666",
      actorId: "77777777-7777-4777-8777-777777777777",
      actorRole: "teacher",
      expiresAt: "2027-02-01T00:00:00.000Z",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNKNOWN_ERROR");
    }
  });
});
