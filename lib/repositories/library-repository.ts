import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type {
  LibraryCategoryItem,
  LibraryChangeRequestItem,
  LibraryChangeRequestStatus,
  LibraryChangeRequestTargetType,
  LibrarySimulationNativeIntegrationStatus,
  LibraryMaterialItem,
  LibrarySimulationItem,
  LibrarySimulationUploadItem,
  LibrarySimulationUploadReviewStatus,
} from "@/lib/types/library";
import type { UserRole } from "@/lib/types/auth";

type LibraryActor = {
  actorId: string;
  actorRole: UserRole;
};

type CourseRelation = { code: string; title: string } | { code: string; title: string }[] | null;
type CategoryRelation = { id: string; name: string } | { id: string; name: string }[] | null;

type LibraryCategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  status: "active" | "archived";
  created_at: string;
};

type LibraryMaterialRow = {
  id: string;
  course_id: string | null;
  uploaded_by: string;
  category_id: string | null;
  title: string;
  description: string | null;
  section_label: string | null;
  tags: string[] | null;
  file_type: string;
  file_size: number;
  storage_bucket?: string;
  storage_path?: string;
  allow_download: boolean;
  status: "draft" | "published" | "archived";
  review_status: "pending_review" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  course?: CourseRelation;
  category?: CategoryRelation;
};

type LibrarySimulationRow = {
  id: string;
  course_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  tags: string[] | null;
  config: unknown;
  status: "draft" | "published" | "archived";
  created_at: string;
  course?: CourseRelation;
  category?: CategoryRelation;
};

type LibrarySimulationUploadRow = {
  id: string;
  uploaded_by: string;
  category_id: string | null;
  title: string;
  description: string | null;
  original_file_name: string;
  file_type: string;
  file_size: number;
  tags: string[] | null;
  requested_course_id: string | null;
  storage_bucket: string;
  storage_path: string;
  review_status: LibrarySimulationUploadReviewStatus;
  native_integration_status: LibrarySimulationNativeIntegrationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  category?: CategoryRelation;
  requested_course?: CourseRelation;
};

type LibraryChangeRequestRow = {
  id: string;
  target_type: LibraryChangeRequestTargetType;
  target_id: string;
  action: "archive" | "delete";
  target_title_snapshot: string;
  target_course_label_snapshot: string | null;
  status: LibraryChangeRequestStatus;
  reason: string | null;
  review_note: string | null;
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type SimulationUploadRecord = LibrarySimulationUploadItem & {
  storageBucket: string;
  storagePath: string;
};

export type CreateSimulationUploadRepositoryInput = {
  actorId: string;
  title: string;
  description?: string;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  storageBucket: "simulation-packages";
  storagePath: string;
  categoryId?: string;
  tags?: string[];
  requestedCourseId?: string;
  reviewStatus: LibrarySimulationUploadReviewStatus;
};

export type ReviewSimulationUploadRepositoryInput = {
  uploadId: string;
  actorId: string;
  reviewStatus: Exclude<LibrarySimulationUploadReviewStatus, "pending_review">;
  reviewNote?: string;
};

export type ReviewMaterialRepositoryInput = {
  materialId: string;
  actorId: string;
  reviewStatus: "approved" | "rejected";
  reviewNote?: string;
};

export type UpsertLibraryCategoryRepositoryInput = {
  categoryId?: string;
  actorId: string;
  name: string;
  slug: string;
  description?: string;
  sortOrder: number;
};

export type LinkSimulationUploadToCourseRepositoryInput = {
  uploadId: string;
  courseId: string;
  actorId: string;
  actorRole: UserRole;
};

export type CreateLibraryChangeRequestRepositoryInput = {
  targetType: LibraryChangeRequestTargetType;
  targetId: string;
  action: "archive" | "delete";
  targetTitleSnapshot: string;
  targetCourseLabelSnapshot?: string;
  requestedBy: string;
  reason?: string;
};

export type ReviewLibraryChangeRequestRepositoryInput = {
  requestId: string;
  reviewedBy: string;
  status: Exclude<LibraryChangeRequestStatus, "pending_review">;
  reviewNote?: string;
};

function firstCourse(course: CourseRelation): { code: string; title: string } | null {
  return Array.isArray(course) ? course[0] ?? null : course;
}

function firstCategory(category: CategoryRelation): { id: string; name: string } | null {
  return Array.isArray(category) ? category[0] ?? null : category;
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("public.simulation_uploads") === true;
}

function toLibraryCategoryItem(row: LibraryCategoryRow): LibraryCategoryItem {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
  };
}

function toLibrarySimulationUploadItem(row: LibrarySimulationUploadRow): LibrarySimulationUploadItem {
  const category = firstCategory(row.category ?? null);
  const requestedCourse = firstCourse(row.requested_course ?? null);

  return {
    id: row.id,
    uploadedBy: row.uploaded_by,
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    title: row.title,
    description: row.description,
    originalFileName: row.original_file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    tags: row.tags ?? [],
    requestedCourseId: row.requested_course_id,
    requestedCourseCode: requestedCourse?.code ?? null,
    requestedCourseTitle: requestedCourse?.title ?? null,
    reviewStatus: row.review_status,
    nativeIntegrationStatus: row.native_integration_status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    reviewNote: row.review_note,
    createdAt: row.created_at,
  };
}

function toSimulationUploadRecord(row: LibrarySimulationUploadRow): SimulationUploadRecord {
  return {
    ...toLibrarySimulationUploadItem(row),
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
  };
}

function toLibraryChangeRequestItem(row: LibraryChangeRequestRow): LibraryChangeRequestItem {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    action: row.action,
    targetTitleSnapshot: row.target_title_snapshot,
    targetCourseLabelSnapshot: row.target_course_label_snapshot,
    status: row.status,
    reason: row.reason,
    reviewNote: row.review_note,
    requestedBy: row.requested_by,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

/**
 * Lists active library categories for upload forms and filters.
 */
export async function listLibraryCategoriesRepository(): Promise<LibraryCategoryItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("library_categories")
    .select("id,name,slug,description,sort_order,status,created_at")
    .eq("status", "active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<LibraryCategoryRow[]>();

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("public.library_categories")) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map(toLibraryCategoryItem);
}

/**
 * Lists material records visible to the current actor.
 */
export async function listLibraryMaterialsRepository(actor?: LibraryActor): Promise<LibraryMaterialItem[]> {
  const supabase = actor ? createServiceRoleSupabaseClient() : await createServerSupabaseClient();
  let query = supabase
    .from("materials")
    .select(
      "id,course_id,uploaded_by,category_id,title,description,section_label,tags,file_type,file_size,allow_download,status,review_status,review_note,created_at,course:courses(code,title),category:library_categories(id,name)",
    )
    .neq("status", "archived")
    .neq("review_status", "rejected");

  if (actor?.actorRole === "teacher") {
    query = query.or(`review_status.eq.approved,uploaded_by.eq.${actor.actorId}`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

  if (error) {
    throw error;
  }

  return ((data ?? []) as LibraryMaterialRow[]).map((row) => {
    const course = firstCourse(row.course ?? null);
    const category = firstCategory(row.category ?? null);

    return {
      id: row.id,
      courseId: row.course_id,
      uploadedBy: row.uploaded_by,
      courseCode: course?.code ?? "",
      courseTitle: course?.title ?? "",
      categoryId: row.category_id,
      categoryName: category?.name ?? null,
      title: row.title,
      description: row.description,
      sectionLabel: row.section_label,
      tags: row.tags ?? [],
      fileType: row.file_type,
      fileSize: row.file_size,
      allowDownload: row.allow_download,
      status: row.status,
      reviewStatus: row.review_status,
      reviewNote: row.review_note,
      createdAt: row.created_at,
    };
  });
}

/**
 * Lists simulation records visible to the current actor.
 */
export async function listLibrarySimulationsRepository(actor?: LibraryActor): Promise<LibrarySimulationItem[]> {
  const supabase = actor ? createServiceRoleSupabaseClient() : await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("simulations")
    .select(
      "id,course_id,category_id,slug,title,description,tags,config,status,created_at,course:courses(code,title),category:library_categories(id,name)",
    )
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === "PGRST205" || error.message.includes("public.simulations")) {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as LibrarySimulationRow[]).map((row) => {
    const course = firstCourse(row.course ?? null);
    const category = firstCategory(row.category ?? null);

    return {
      id: row.id,
      courseId: row.course_id,
      courseCode: course?.code ?? "",
      courseTitle: course?.title ?? "",
      categoryId: row.category_id,
      categoryName: category?.name ?? null,
      slug: row.slug,
      title: row.title,
      description: row.description,
      tags: row.tags ?? [],
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

/**
 * Lists uploaded standalone HTML simulations visible to the current actor.
 */
export async function listLibrarySimulationUploadsRepository(actor?: LibraryActor): Promise<LibrarySimulationUploadItem[]> {
  const supabase = actor ? createServiceRoleSupabaseClient() : await createServerSupabaseClient();
  let query = supabase
    .from("simulation_uploads")
    .select(
      "id,uploaded_by,category_id,title,description,original_file_name,file_type,file_size,tags,requested_course_id,storage_bucket,storage_path,review_status,native_integration_status,reviewed_by,reviewed_at,review_note,created_at,category:library_categories(id,name),requested_course:courses!simulation_uploads_requested_course_id_fkey(code,title)",
    );

  if (actor?.actorRole === "teacher") {
    query = query.or(`review_status.eq.approved,uploaded_by.eq.${actor.actorId}`);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as LibrarySimulationUploadRow[]).map(toLibrarySimulationUploadItem);
}

/**
 * Creates metadata for an uploaded standalone HTML simulation package.
 */
export async function createSimulationUploadRepository(
  input: CreateSimulationUploadRepositoryInput,
): Promise<LibrarySimulationUploadItem> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("simulation_uploads")
    .insert({
      uploaded_by: input.actorId,
      title: input.title,
      description: input.description ?? null,
      original_file_name: input.originalFileName,
      file_type: input.fileType,
      file_size: input.fileSize,
      category_id: input.categoryId ?? null,
      tags: input.tags ?? [],
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      requested_course_id: input.requestedCourseId ?? null,
      review_status: input.reviewStatus,
      native_integration_status: "not_requested",
    })
    .select(
      "id,uploaded_by,category_id,title,description,original_file_name,file_type,file_size,tags,requested_course_id,storage_bucket,storage_path,review_status,native_integration_status,reviewed_by,reviewed_at,review_note,created_at,category:library_categories(id,name),requested_course:courses!simulation_uploads_requested_course_id_fkey(code,title)",
    )
    .single();

  if (error) {
    throw error;
  }

  return toLibrarySimulationUploadItem(data as LibrarySimulationUploadRow);
}

/**
 * Updates review status for a pending simulation upload.
 */
export async function reviewSimulationUploadRepository(
  input: ReviewSimulationUploadRepositoryInput,
): Promise<LibrarySimulationUploadItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("simulation_uploads")
    .update({
      review_status: input.reviewStatus,
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
    })
    .eq("id", input.uploadId)
    .select(
      "id,uploaded_by,category_id,title,description,original_file_name,file_type,file_size,tags,requested_course_id,storage_bucket,storage_path,review_status,native_integration_status,reviewed_by,reviewed_at,review_note,created_at,category:library_categories(id,name),requested_course:courses!simulation_uploads_requested_course_id_fkey(code,title)",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toLibrarySimulationUploadItem(data as LibrarySimulationUploadRow) : null;
}

export async function reviewMaterialRepository(
  input: ReviewMaterialRepositoryInput,
): Promise<(LibraryMaterialItem & { storageBucket: string; storagePath: string }) | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("materials")
    .select(
      "id,course_id,uploaded_by,category_id,title,description,section_label,tags,file_type,file_size,storage_bucket,storage_path,allow_download,status,review_status,review_note,created_at,course:courses(code,title),category:library_categories(id,name)",
    )
    .eq("id", input.materialId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    return null;
  }

  if (input.reviewStatus === "rejected") {
    const { error: deleteError } = await supabase.from("materials").delete().eq("id", input.materialId);

    if (deleteError) {
      throw deleteError;
    }

    const rejectedRow = existing as LibraryMaterialRow;
    const rejectedCourse = firstCourse(rejectedRow.course ?? null);
    const rejectedCategory = firstCategory(rejectedRow.category ?? null);

    return {
      id: rejectedRow.id,
      courseId: rejectedRow.course_id,
      uploadedBy: rejectedRow.uploaded_by,
      courseCode: rejectedCourse?.code ?? "",
      courseTitle: rejectedCourse?.title ?? "",
      categoryId: rejectedRow.category_id,
      categoryName: rejectedCategory?.name ?? null,
      title: rejectedRow.title,
      description: rejectedRow.description,
      sectionLabel: rejectedRow.section_label,
      tags: rejectedRow.tags ?? [],
      fileType: rejectedRow.file_type,
      fileSize: rejectedRow.file_size,
      storageBucket: rejectedRow.storage_bucket ?? "",
      storagePath: rejectedRow.storage_path ?? "",
      allowDownload: rejectedRow.allow_download,
      status: rejectedRow.status,
      reviewStatus: "rejected",
      reviewNote: input.reviewNote ?? null,
      createdAt: rejectedRow.created_at,
    };
  }

  const { data, error } = await supabase
    .from("materials")
    .update({
      review_status: input.reviewStatus,
      reviewed_by: input.actorId,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
    })
    .eq("id", input.materialId)
    .select(
      "id,course_id,uploaded_by,category_id,title,description,section_label,tags,file_type,file_size,storage_bucket,storage_path,allow_download,status,review_status,review_note,created_at,course:courses(code,title),category:library_categories(id,name)",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as LibraryMaterialRow;
  const course = firstCourse(row.course ?? null);
  const category = firstCategory(row.category ?? null);

  return {
    id: row.id,
    courseId: row.course_id,
    uploadedBy: row.uploaded_by,
    courseCode: course?.code ?? "",
    courseTitle: course?.title ?? "",
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    title: row.title,
    description: row.description,
    sectionLabel: row.section_label,
    tags: row.tags ?? [],
    fileType: row.file_type,
    fileSize: row.file_size,
    storageBucket: row.storage_bucket ?? "",
    storagePath: row.storage_path ?? "",
    allowDownload: row.allow_download,
    status: row.status,
    reviewStatus: row.review_status,
    reviewNote: row.review_note,
    createdAt: row.created_at,
  };
}

/**
 * Marks an upload as requested for native widget conversion.
 */
export async function requestNativeSimulationIntegrationRepository(uploadId: string): Promise<LibrarySimulationUploadItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("simulation_uploads")
    .update({ native_integration_status: "requested" })
    .eq("id", uploadId)
    .select(
      "id,uploaded_by,category_id,title,description,original_file_name,file_type,file_size,tags,requested_course_id,storage_bucket,storage_path,review_status,native_integration_status,reviewed_by,reviewed_at,review_note,created_at,category:library_categories(id,name),requested_course:courses!simulation_uploads_requested_course_id_fkey(code,title)",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toLibrarySimulationUploadItem(data as LibrarySimulationUploadRow) : null;
}

/**
 * Reviews native widget integration request for an uploaded HTML simulation.
 */
export async function reviewNativeSimulationIntegrationRepository(input: {
  uploadId: string;
  nativeIntegrationStatus: "accepted" | "rejected";
  reviewedBy: string;
  reviewNote?: string;
}): Promise<LibrarySimulationUploadItem | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("simulation_uploads")
    .update({
      native_integration_status: input.nativeIntegrationStatus,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: input.reviewNote ?? null,
    })
    .eq("id", input.uploadId)
    .select(
      "id,uploaded_by,category_id,title,description,original_file_name,file_type,file_size,tags,requested_course_id,storage_bucket,storage_path,review_status,native_integration_status,reviewed_by,reviewed_at,review_note,created_at,category:library_categories(id,name),requested_course:courses!simulation_uploads_requested_course_id_fkey(code,title)",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toLibrarySimulationUploadItem(data as LibrarySimulationUploadRow) : null;
}

/**
 * Reads one upload with storage metadata by service role after higher-level services verify access.
 */
export async function getSimulationUploadByIdRepository(uploadId: string): Promise<SimulationUploadRecord | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("simulation_uploads")
    .select(
      "id,uploaded_by,category_id,title,description,original_file_name,file_type,file_size,tags,storage_bucket,storage_path,review_status,native_integration_status,reviewed_by,reviewed_at,review_note,created_at,category:library_categories(id,name)",
    )
    .eq("id", uploadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toSimulationUploadRecord(data as LibrarySimulationUploadRow) : null;
}

/**
 * Checks whether the current actor can see a published simulation registry item for the uploaded package.
 */
export async function hasVisiblePublishedSimulationForUploadRepository(uploadId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("simulations")
    .select("id,config,status")
    .eq("status", "published")
    .limit(200);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("public.simulations")) {
      return false;
    }

    throw error;
  }

  return ((data ?? []) as LibrarySimulationRow[]).some((row) => {
    const config = row.config;
    return Boolean(
      config &&
        typeof config === "object" &&
        "uploadId" in config &&
        (config as { uploadId?: unknown }).uploadId === uploadId,
    );
  });
}

/**
 * Creates a published simulation registry item from an approved HTML upload.
 */
export async function linkSimulationUploadToCourseRepository(
  input: LinkSimulationUploadToCourseRepositoryInput,
): Promise<LibrarySimulationItem> {
  const upload = await getSimulationUploadByIdRepository(input.uploadId);

  if (!upload) {
    throw new Error("Không tìm thấy mô phỏng đã tải lên.");
  }

  const supabase = await createServerSupabaseClient();
  const slug = `html-upload-${input.uploadId.replace(/-/g, "").slice(0, 20)}`;
  const { data, error } = await supabase
    .from("simulations")
    .upsert(
      {
        course_id: input.courseId,
        slug,
        title: upload.title,
        description: upload.description,
        category_id: upload.categoryId,
        tags: upload.tags,
        config: {
          source: "html_upload",
          uploadId: input.uploadId,
          fileType: upload.fileType,
          openMode: "new_tab",
        },
        sort_order: 0,
        status: "published",
      },
      { onConflict: "course_id,slug" },
    )
    .select("id,course_id,category_id,slug,title,description,tags,config,status,created_at,course:courses(code,title),category:library_categories(id,name)")
    .single();

  if (error) {
    throw error;
  }

  const row = data as LibrarySimulationRow;
  const course = firstCourse(row.course ?? null);

  return {
    id: row.id,
    courseId: row.course_id,
    courseCode: course?.code ?? "",
    courseTitle: course?.title ?? "",
    categoryId: row.category_id,
    categoryName: firstCategory(row.category ?? null)?.name ?? null,
    slug: row.slug,
    title: row.title,
    description: row.description,
    tags: row.tags ?? [],
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Creates or updates one library category.
 */
export async function upsertLibraryCategoryRepository(
  input: UpsertLibraryCategoryRepositoryInput,
): Promise<LibraryCategoryItem> {
  const supabase = createServiceRoleSupabaseClient();
  const payload = {
    name: input.name,
    slug: input.slug,
    description: input.description ?? null,
    sort_order: input.sortOrder,
    status: "active" as const,
    created_by: input.actorId,
    updated_at: new Date().toISOString(),
  };

  const query = input.categoryId
    ? supabase.from("library_categories").update(payload).eq("id", input.categoryId)
    : supabase.from("library_categories").insert(payload);

  const { data, error } = await query
    .select("id,name,slug,description,sort_order,status,created_at")
    .single<LibraryCategoryRow>();

  if (error) {
    throw error;
  }

  return toLibraryCategoryItem(data);
}

/**
 * Archives one category so old resources keep their snapshot while it disappears from upload choices.
 */
export async function archiveLibraryCategoryRepository(categoryId: string): Promise<LibraryCategoryItem | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("library_categories")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", categoryId)
    .select("id,name,slug,description,sort_order,status,created_at")
    .maybeSingle<LibraryCategoryRow>();

  if (error) {
    throw error;
  }

  return data ? toLibraryCategoryItem(data) : null;
}

/**
 * Lists library change requests visible to the current actor.
 */
export async function listLibraryChangeRequestsRepository(): Promise<LibraryChangeRequestItem[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("library_change_requests")
    .select(
      "id,target_type,target_id,action,target_title_snapshot,target_course_label_snapshot,status,reason,review_note,requested_by,reviewed_by,reviewed_at,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === "PGRST205" || error.code === "42P01" || error.message.includes("public.library_change_requests")) {
      return [];
    }

    throw error;
  }

  return ((data ?? []) as LibraryChangeRequestRow[]).map(toLibraryChangeRequestItem);
}

/**
 * Finds a visible library resource and returns a stable snapshot for review.
 */
export async function getLibraryResourceSnapshotRepository(input: {
  targetType: LibraryChangeRequestTargetType;
  targetId: string;
}): Promise<{ title: string; courseLabel: string | null; status: string } | null> {
  const supabase = await createServerSupabaseClient();

  if (input.targetType === "material") {
    const { data, error } = await supabase
      .from("materials")
      .select("title,status,course:courses(code,title)")
      .eq("id", input.targetId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const row = data as { title: string; status: string; course?: CourseRelation };
    const course = firstCourse(row.course ?? null);

    return {
      title: row.title,
      courseLabel: course ? `${course.code} - ${course.title}` : null,
      status: row.status,
    };
  }

  const { data, error } = await supabase
    .from("simulations")
    .select("title,status,course:courses(code,title)")
    .eq("id", input.targetId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as { title: string; status: string; course?: CourseRelation };
  const course = firstCourse(row.course ?? null);

  return {
    title: row.title,
    courseLabel: course ? `${course.code} - ${course.title}` : null,
    status: row.status,
  };
}

/**
 * Creates one pending archive request for a material or simulation.
 */
export async function createLibraryChangeRequestRepository(
  input: CreateLibraryChangeRequestRepositoryInput,
): Promise<LibraryChangeRequestItem> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("library_change_requests")
    .insert({
      target_type: input.targetType,
      target_id: input.targetId,
      action: input.action,
      target_title_snapshot: input.targetTitleSnapshot,
      target_course_label_snapshot: input.targetCourseLabelSnapshot ?? null,
      requested_by: input.requestedBy,
      reason: input.reason ?? null,
      status: "pending_review",
    })
    .select(
      "id,target_type,target_id,action,target_title_snapshot,target_course_label_snapshot,status,reason,review_note,requested_by,reviewed_by,reviewed_at,created_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return toLibraryChangeRequestItem(data as LibraryChangeRequestRow);
}

/**
 * Reads one change request with service role for reviewer-side status transition.
 */
export async function getLibraryChangeRequestByIdRepository(requestId: string): Promise<LibraryChangeRequestItem | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("library_change_requests")
    .select(
      "id,target_type,target_id,action,target_title_snapshot,target_course_label_snapshot,status,reason,review_note,requested_by,reviewed_by,reviewed_at,created_at",
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toLibraryChangeRequestItem(data as LibraryChangeRequestRow) : null;
}

/**
 * Updates reviewer decision for a library change request.
 */
export async function reviewLibraryChangeRequestRepository(
  input: ReviewLibraryChangeRequestRepositoryInput,
): Promise<LibraryChangeRequestItem | null> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("library_change_requests")
    .update({
      status: input.status,
      review_note: input.reviewNote ?? null,
      reviewed_by: input.reviewedBy,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", input.requestId)
    .select(
      "id,target_type,target_id,action,target_title_snapshot,target_course_label_snapshot,status,reason,review_note,requested_by,reviewed_by,reviewed_at,created_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toLibraryChangeRequestItem(data as LibraryChangeRequestRow) : null;
}

/**
 * Archives a material or simulation after a reviewer approves the request.
 */
export async function archiveLibraryResourceRepository(input: {
  targetType: LibraryChangeRequestTargetType;
  targetId: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();
  const table = input.targetType === "material" ? "materials" : "simulations";
  const { error } = await supabase.from(table).update({ status: "archived" }).eq("id", input.targetId);

  if (error) {
    throw error;
  }
}

/**
 * Deletes material/simulation metadata after a reviewer approves a delete request.
 * Material storage objects are removed before metadata deletion when possible.
 */
export async function deleteLibraryResourceRepository(input: {
  targetType: LibraryChangeRequestTargetType;
  targetId: string;
}): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  if (input.targetType === "material") {
    const { data, error: readError } = await supabase
      .from("materials")
      .select("storage_bucket,storage_path")
      .eq("id", input.targetId)
      .maybeSingle();

    if (readError) {
      throw readError;
    }

    if (data?.storage_bucket && data.storage_path) {
      await supabase.storage.from(data.storage_bucket).remove([data.storage_path]);
    }

    const { error } = await supabase.from("materials").delete().eq("id", input.targetId);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("simulations").delete().eq("id", input.targetId);

  if (error) {
    throw error;
  }
}

/**
 * Deletes a teacher-owned personal library resource before it enters the shared library.
 */
export async function deletePersonalLibraryResourceRepository(input: {
  targetType: "material" | "simulation_upload";
  targetId: string;
  actorId: string;
}): Promise<boolean> {
  const supabase = createServiceRoleSupabaseClient();

  if (input.targetType === "material") {
    const { data, error: readError } = await supabase
      .from("materials")
      .select("id,uploaded_by,course_id,storage_bucket,storage_path")
      .eq("id", input.targetId)
      .maybeSingle();

    if (readError) {
      throw readError;
    }

    if (!data || data.uploaded_by !== input.actorId || data.course_id) {
      return false;
    }

    if (data.storage_bucket && data.storage_path) {
      await supabase.storage.from(data.storage_bucket).remove([data.storage_path]);
    }

    const { error } = await supabase.from("materials").delete().eq("id", input.targetId);

    if (error) {
      throw error;
    }

    return true;
  }

  const { data, error: readError } = await supabase
    .from("simulation_uploads")
    .select("id,uploaded_by,requested_course_id,storage_bucket,storage_path")
    .eq("id", input.targetId)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  if (!data || data.uploaded_by !== input.actorId || data.requested_course_id) {
    return false;
  }

  if (data.storage_bucket && data.storage_path) {
    await supabase.storage.from(data.storage_bucket).remove([data.storage_path]);
  }

  const { error } = await supabase.from("simulation_uploads").delete().eq("id", input.targetId);

  if (error) {
    throw error;
  }

  return true;
}
