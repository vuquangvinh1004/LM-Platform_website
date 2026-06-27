"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ClassResourceActionState } from "@/app/(teacher)/classes/[classId]/resources/resource-action-state";
import { requireRole } from "@/lib/services/auth-service";
import { replaceClassResourceLinks } from "@/lib/services/class-resource-service";
import { syncClassTemplateSnapshot } from "@/lib/services/classroom-service";
import type { ClassResourceActorRole } from "@/lib/services/class-resource-service";

export async function saveClassResourcesAction(
  classId: string,
  _prevState: ClassResourceActionState,
  formData: FormData,
): Promise<ClassResourceActionState> {
  const profileResult = await requireRole(["teacher", "moderator", "admin"]);

  if (!profileResult.ok) {
    return { status: "error", message: profileResult.error.message };
  }

  const materialIds = formData.getAll("materialIds").map(String).filter(Boolean);
  const simulationIds = formData.getAll("simulationIds").map(String).filter(Boolean);
  const returnTo = String(formData.get("returnTo") ?? "").trim();

  const result = await replaceClassResourceLinks({
    classId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role as ClassResourceActorRole,
    materialIds,
    simulationIds,
  });

  if (!result.ok) {
    return { status: "error", message: result.error.message };
  }

  await syncClassTemplateSnapshot(classId);

  revalidatePath(`/classes/${classId}/resources`);
  revalidatePath(`/classes/${classId}/room`);

  if (returnTo.startsWith(`/classes/${classId}/`)) {
    revalidatePath(returnTo);
    redirect(returnTo);
  }

  return {
    status: "success",
    message: "Đã cập nhật tài nguyên hiển thị trong lớp học.",
  };
}
