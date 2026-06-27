import { z } from "zod";

const courseCloItemSchema = z.object({
  code: z.string().trim().min(1).max(50),
  description: z.string().trim().min(1).max(1000),
});

const courseAssessmentComponentSchema = z.object({
  type: z.string().trim().min(1).max(100),
  weight: z.coerce.number().min(0).max(100),
});

export const createCourseSchema = z.object({
  ownerId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]).default("admin"),
  code: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  visibility: z.enum(["private", "unlisted", "public_preview"]).default("private"),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  credits: z.coerce.number().int().min(1).max(20).optional(),
  knowledgeBlock: z.enum(["general", "foundation", "major"]).optional(),
  courseType: z.enum(["required", "elective"]).optional(),
  assignedTeacherIds: z.array(z.string().uuid()).default([]),
  cloItems: z.array(courseCloItemSchema).default([]),
  assessmentComponents: z.array(courseAssessmentComponentSchema).default([]),
}).superRefine((value, context) => {
  if (value.assessmentComponents.length === 0) {
    return;
  }

  const totalWeight = value.assessmentComponents.reduce((total, component) => total + component.weight, 0);

  if (Math.abs(totalWeight - 100) > 0.001) {
    context.addIssue({
      code: "custom",
      message: "Tổng trọng số các thành phần đánh giá phải bằng 100%.",
      path: ["assessmentComponents"],
    });
  }
});

export const listCoursesForUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["admin", "moderator", "teacher", "student"]),
  query: z.string().trim().min(1).max(255).optional(),
  status: z.enum(["draft", "active", "archived"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const updateCourseSchema = z.object({
  courseId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  visibility: z.enum(["private", "unlisted", "public_preview"]),
  status: z.enum(["draft", "active", "archived"]),
  credits: z.coerce.number().int().min(1).max(20).optional(),
  knowledgeBlock: z.enum(["general", "foundation", "major"]).optional(),
  courseType: z.enum(["required", "elective"]).optional(),
  cloItems: z.array(courseCloItemSchema).default([]),
  assessmentComponents: z.array(courseAssessmentComponentSchema).default([]),
}).superRefine((value, context) => {
  if (value.assessmentComponents.length === 0) {
    return;
  }

  const totalWeight = value.assessmentComponents.reduce((total, component) => total + component.weight, 0);

  if (Math.abs(totalWeight - 100) > 0.001) {
    context.addIssue({
      code: "custom",
      message: "Tổng trọng số các thành phần đánh giá phải bằng 100%.",
      path: ["assessmentComponents"],
    });
  }
});

export const archiveCourseSchema = z.object({
  courseId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
});

export const deleteCourseSchema = z.object({
  courseId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
});
