import { z } from "zod";

const MAX_FILE_SIZE_BYTES = 19 * 1024 * 1024;

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
] as const;

export const createMaterialUploadIntentSchema = z.object({
  courseId: z.string().uuid().optional(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(allowedMimeTypes),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

export const registerUploadedMaterialSchema = z.object({
  courseId: z.string().uuid().optional(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  categoryId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  sectionLabel: z.string().trim().max(255).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  storageBucket: z.literal("course-materials"),
  storagePath: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  fileType: z.enum(allowedMimeTypes),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  allowDownload: z.boolean(),
});

export const getReadableMaterialSchema = z.object({
  materialId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  classId: z.string().uuid().optional(),
});

export const materialUploadConstraints = {
  allowedMimeTypes: [...allowedMimeTypes],
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
};
