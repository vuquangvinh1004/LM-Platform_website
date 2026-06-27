"use server";

import { Buffer } from "node:buffer";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/services/auth-service";
import type { ClassroomAssignmentActionState } from "@/components/classroom/classroom-assignment-action-state";
import {
  appendClassSessionAssignment,
  appendClassSessionExtraMaterial,
  appendClassSessionLectureItem,
  appendClassSessionQuickReviewQuestion,
  removeClassSessionItem,
  syncClassTemplateSnapshot,
  updateClassSessionAccess,
  updateClassSessionOverview,
} from "@/lib/services/classroom-service";

function sessionPath(classId: string, sessionId: string): string {
  return `/classes/${classId}/sessions/${sessionId}`;
}

function optionalString(formData: FormData, name: string): string | undefined {
  const value = String(formData.get(name) ?? "").trim();
  return value || undefined;
}

async function requireManager() {
  return requireRole(["teacher", "moderator", "admin"]);
}

async function toAssignmentImagePayload(file: FormDataEntryValue | null): Promise<{ imageName?: string; imageDataUrl?: string; error?: string }> {
  if (!(file instanceof File) || file.size === 0) {
    return {};
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Ảnh đính kèm phải là file ảnh hợp lệ (PNG, JPG, JPEG, WebP, GIF)." };
  }

  if (file.size > 3 * 1024 * 1024) {
    return { error: "Ảnh đính kèm vượt quá 3MB. Vui lòng chọn ảnh nhỏ hơn." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  return {
    imageName: file.name,
    imageDataUrl: `data:${file.type};base64,${bytes.toString("base64")}`,
  };
}

export async function updateClassSessionOverviewAction(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const profileResult = await requireManager();

  if (!profileResult.ok) {
    redirect(sessionPath(classId, sessionId));
  }

  await updateClassSessionOverview({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    title: String(formData.get("title") ?? "").trim(),
    overviewContent: optionalString(formData, "overviewContent"),
    overviewObjectives: optionalString(formData, "overviewObjectives"),
  });

  await syncClassTemplateSnapshot(classId);

  revalidatePath(sessionPath(classId, sessionId));
  revalidatePath(`/my-classes/${classId}/sessions/${sessionId}`);
  redirect(sessionPath(classId, sessionId));
}

export async function updateClassSessionAccessAction(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const profileResult = await requireManager();

  if (!profileResult.ok) {
    redirect(sessionPath(classId, sessionId));
  }

  await updateClassSessionAccess({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    studentAccess: String(formData.get("studentAccess") ?? "open") as "open" | "locked" | "scheduled",
    availableFrom: optionalString(formData, "availableFrom")
      ? new Date(String(formData.get("availableFrom"))).toISOString()
      : undefined,
  });

  await syncClassTemplateSnapshot(classId);

  revalidatePath(sessionPath(classId, sessionId));
  revalidatePath(`/my-classes/${classId}/sessions/${sessionId}`);
  revalidatePath(`/classes/${classId}/room`);
  revalidatePath(`/my-classes/${classId}/room`);
  redirect(sessionPath(classId, sessionId));
}

export async function addClassSessionLectureItemAction(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const profileResult = await requireManager();

  if (!profileResult.ok) {
    redirect(sessionPath(classId, sessionId));
  }

  const result = await appendClassSessionLectureItem({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    type: String(formData.get("type") ?? "slide") as "slide" | "video" | "audio" | "reading",
    title: String(formData.get("title") ?? "").trim(),
    url: optionalString(formData, "url"),
    content: optionalString(formData, "content"),
  });

  if (!result.ok) {
    console.error(result.error);
  }

  await syncClassTemplateSnapshot(classId);

  revalidatePath(sessionPath(classId, sessionId));
  revalidatePath(`/my-classes/${classId}/sessions/${sessionId}`);
  redirect(sessionPath(classId, sessionId));
}

export async function addClassSessionExtraMaterialAction(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const profileResult = await requireManager();

  if (!profileResult.ok) {
    redirect(sessionPath(classId, sessionId));
  }

  const result = await appendClassSessionExtraMaterial({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    title: String(formData.get("title") ?? "").trim(),
    url: optionalString(formData, "url"),
    note: optionalString(formData, "note"),
  });

  if (!result.ok) {
    console.error(result.error);
  }

  await syncClassTemplateSnapshot(classId);

  revalidatePath(sessionPath(classId, sessionId));
  revalidatePath(`/my-classes/${classId}/sessions/${sessionId}`);
  redirect(sessionPath(classId, sessionId));
}

export async function addClassSessionAssignmentAction(
  classId: string,
  sessionId: string,
  _prevState: ClassroomAssignmentActionState,
  formData: FormData,
): Promise<ClassroomAssignmentActionState> {
  const profileResult = await requireManager();

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.error.message,
    };
  }

  const imagePayload = await toAssignmentImagePayload(formData.get("imageFile"));

  if (imagePayload.error) {
    return {
      status: "error",
      message: imagePayload.error,
    };
  }

  const result = await appendClassSessionAssignment({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    title: String(formData.get("title") ?? "").trim(),
    instructions: optionalString(formData, "instructions"),
    imageName: imagePayload.imageName,
    imageDataUrl: imagePayload.imageDataUrl,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.error.message,
    };
  }

  await syncClassTemplateSnapshot(classId);

  revalidatePath(sessionPath(classId, sessionId));
  revalidatePath(`/my-classes/${classId}/sessions/${sessionId}`);

  return {
    status: "success",
    message: "Đã thêm bài tập.",
  };
}

export async function addClassSessionQuickReviewQuestionAction(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const profileResult = await requireManager();

  if (!profileResult.ok) {
    redirect(sessionPath(classId, sessionId));
  }

  const options = formData.getAll("options").map(String).map((value) => value.trim()).filter(Boolean);
  const optionGuidances = formData.getAll("optionGuidances").map(String).map((value) => value.trim());
  const correctOptionIndexes = formData
    .getAll("correctOptionIndexes")
    .map((value) => Number(String(value)))
    .filter((value) => Number.isInteger(value));

  await appendClassSessionQuickReviewQuestion({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    type: String(formData.get("type") ?? "multiple_choice") as "multiple_choice" | "multiple_answer",
    question: String(formData.get("question") ?? "").trim(),
    guidance: optionalString(formData, "guidance"),
    options,
    optionGuidances,
    correctOptionIndexes,
  });

  await syncClassTemplateSnapshot(classId);

  revalidatePath(sessionPath(classId, sessionId));
  revalidatePath(`/my-classes/${classId}/sessions/${sessionId}`);
  redirect(sessionPath(classId, sessionId));
}

export async function removeClassSessionItemAction(classId: string, sessionId: string, formData: FormData): Promise<void> {
  const profileResult = await requireManager();

  if (!profileResult.ok) {
    redirect(sessionPath(classId, sessionId));
  }

  await removeClassSessionItem({
    classId,
    sessionId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    collection: String(formData.get("collection") ?? "") as "lectureItems" | "extraMaterials" | "assignments" | "quickReviewQuestions",
    itemId: String(formData.get("itemId") ?? "").trim(),
  });

  await syncClassTemplateSnapshot(classId);

  revalidatePath(sessionPath(classId, sessionId));
  revalidatePath(`/my-classes/${classId}/sessions/${sessionId}`);
  redirect(sessionPath(classId, sessionId));
}
