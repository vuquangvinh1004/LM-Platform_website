import {
  getClassResourceManagerDataRepository,
  replaceClassResourceLinksRepository,
} from "@/lib/repositories/class-resource-repository";
import { findManageableClassRepository, type ManageableClassRecord } from "@/lib/repositories/class-repository";
import type { ClassResourceManagerData } from "@/lib/types/class-resource";
import type { UserRole } from "@/lib/types/auth";
import type { ServiceResult } from "@/lib/types/service-result";
import { timed } from "@/lib/utils/timing";

export type ClassResourceActorRole = Extract<UserRole, "teacher" | "moderator" | "admin">;

export async function getClassResourceManagerData(input: {
  classId: string;
  actorId: string;
  actorRole: ClassResourceActorRole;
}): Promise<ServiceResult<ClassResourceManagerData>> {
  try {
    const manageableClass = await timed("class-resource.manageableClass", () =>
      findManageableClassRepository({
        classId: input.classId,
        actorId: input.actorId,
        actorRole: input.actorRole,
      }),
    );

    if (!manageableClass) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp hoặc bạn không có quyền quản lý tài nguyên của lớp này.",
        },
      };
    }

    const data = await timed("class-resource.managerData", () =>
      getClassResourceManagerDataRepository(input.classId, manageableClass as Pick<
        ManageableClassRecord,
        "id" | "courseId" | "classCode" | "title" | "courseCode" | "courseTitle"
      >),
    );

    if (!data) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học phần.",
        },
      };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải danh sách tài nguyên của lớp.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function replaceClassResourceLinks(input: {
  classId: string;
  actorId: string;
  actorRole: ClassResourceActorRole;
  materialIds: string[];
  simulationIds: string[];
}): Promise<ServiceResult<ClassResourceManagerData>> {
  try {
    const manageableClass = await timed("class-resource.manageableClass", () =>
      findManageableClassRepository({
        classId: input.classId,
        actorId: input.actorId,
        actorRole: input.actorRole,
      }),
    );

    if (!manageableClass) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp hoặc bạn không có quyền quản lý tài nguyên của lớp này.",
        },
      };
    }

    const currentData = await timed("class-resource.currentData", () =>
      getClassResourceManagerDataRepository(input.classId, manageableClass as Pick<
        ManageableClassRecord,
        "id" | "courseId" | "classCode" | "title" | "courseCode" | "courseTitle"
      >),
    );

    if (!currentData) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: "Không tìm thấy lớp học phần.",
        },
      };
    }

    const availableMaterialIds = new Set(currentData.materials.map((material) => material.id));
    const availableSimulationIds = new Set(currentData.simulations.map((simulation) => simulation.id));
    const materialIds = [...new Set(input.materialIds)].filter((id) => availableMaterialIds.has(id));
    const simulationIds = [...new Set(input.simulationIds)].filter((id) => availableSimulationIds.has(id));

    await timed("class-resource.updateLinks", () =>
      replaceClassResourceLinksRepository({
        classId: input.classId,
        linkedBy: input.actorId,
        materialIds,
        simulationIds,
      }),
    );

    return {
      ok: true,
      data: {
        ...currentData,
        linkedMaterialIds: materialIds,
        linkedSimulationIds: simulationIds,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể cập nhật tài nguyên của lớp.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
