import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { Material } from "@/lib/types/material";

export type FindCourseForMaterialUploadRepositoryInput = {
  courseId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
};

export type MaterialUploadCourseRecord = {
  id: string;
  ownerId: string;
  status: "draft" | "active" | "archived";
  code?: string;
  title?: string;
};

export type CreateMaterialRepositoryInput = {
  courseId?: string;
  actorId: string;
  categoryId?: string;
  title: string;
  description?: string;
  sectionLabel?: string;
  tags?: string[];
  storageBucket: "course-materials";
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  allowDownload: boolean;
  reviewStatus: "pending_review" | "approved" | "rejected";
};

export type GetReadableMaterialRepositoryInput = {
  materialId: string;
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  useServiceRole?: boolean;
};

export type ReadableMaterialRecord = {
  id: string;
  courseId: string | null;
  title: string;
  fileType: string;
  storageBucket: string | null;
  storagePath: string | null;
  allowDownload: boolean;
  status: "draft" | "published" | "archived";
  reviewStatus: "pending_review" | "approved" | "rejected";
};

/**
 * Finds a course record that the actor can upload materials for.
 * Repository does not enforce role rules beyond ownership/admin filtering.
 */
export async function findCourseForMaterialUploadRepository(
  input: FindCourseForMaterialUploadRepositoryInput,
): Promise<MaterialUploadCourseRecord | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("courses").select("id,owner_id,status,code,title").eq("id", input.courseId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    ownerId: data.owner_id,
    status: data.status,
    code: data.code,
    title: data.title,
  };
}

/**
 * Creates material metadata after the file has been uploaded successfully.
 */
export async function createMaterialRepository(input: CreateMaterialRepositoryInput): Promise<Material> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("materials")
    .insert({
      course_id: input.courseId,
      uploaded_by: input.actorId,
      category_id: input.categoryId ?? null,
      title: input.title,
      description: input.description ?? null,
      section_label: input.sectionLabel ?? null,
      tags: input.tags ?? [],
      file_name: input.fileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      allow_download: input.allowDownload,
      sort_order: 0,
      status: "published",
      review_status: input.reviewStatus,
    })
    .select(
      "id,course_id,uploaded_by,category_id,title,description,section_label,tags,file_name,file_type,file_size,storage_bucket,storage_path,allow_download,sort_order,status,review_status,review_note,created_at,updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    courseId: data.course_id,
    uploadedBy: data.uploaded_by,
    categoryId: data.category_id,
    title: data.title,
    description: data.description,
    sectionLabel: data.section_label,
    tags: data.tags ?? [],
    fileName: data.file_name,
    fileType: data.file_type,
    fileSize: data.file_size,
    storageBucket: data.storage_bucket,
    storagePath: data.storage_path,
    allowDownload: data.allow_download,
    sortOrder: data.sort_order,
    status: data.status,
    reviewStatus: data.review_status,
    reviewNote: data.review_note,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Returns one material record filtered by actor visibility rules.
 */
export async function getReadableMaterialRepository(
  input: GetReadableMaterialRepositoryInput,
): Promise<ReadableMaterialRecord | null> {
  const supabase = input.useServiceRole ? createServiceRoleSupabaseClient() : await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("materials")
    .select("id,course_id,title,file_type,storage_bucket,storage_path,allow_download,status,review_status")
    .eq("id", input.materialId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    courseId: data.course_id,
    title: data.title,
    fileType: data.file_type,
    storageBucket: data.storage_bucket,
    storagePath: data.storage_path,
    allowDownload: data.allow_download,
    status: data.status,
    reviewStatus: data.review_status,
  };
}
