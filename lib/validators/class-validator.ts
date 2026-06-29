import { z } from "zod";

export const createClassSchema = z.object({
  courseId: z.string().uuid(),
  teacherId: z.string().uuid(),
  teacherRole: z.enum(["admin", "moderator", "teacher", "student"]),
  classCode: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(255),
  semester: z.string().trim().max(100).optional(),
  academicYear: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "active", "archived"]).default("active"),
  isOpenForEnrollment: z.boolean().default(false),
});

export const addStudentsToClassSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  students: z
    .array(
      z.object({
        email: z.email().optional(),
        studentCode: z.string().trim().min(1).max(100).optional(),
        fullName: z.string().trim().min(1).max(255),
      }),
    )
    .min(1),
});

export const importStudentsToClassSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  csvContent: z.string().trim().min(1),
});

export const listClassMembersSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listClassesForUserSchema = z.object({
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
