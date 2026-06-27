import { z } from "zod";

export const scopedPermissionCheckSchema = z.object({
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  resourceType: z.enum(["course", "class"]),
  resourceId: z.string().uuid(),
  permission: z.string().trim().min(1).max(100),
});

export const approveStudentAccessSchema = z.object({
  studentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher"]),
  expiresAt: z.iso.datetime().optional(),
});

export const renewStudentAccessSchema = z.object({
  studentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher"]),
  expiresAt: z.iso.datetime(),
});
