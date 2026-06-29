import { z } from "zod";

const isoDatetimeSchema = z.string().datetime({ offset: true });

export const createAssessmentSchema = z.object({
  classId: z.string().uuid(),
  courseId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  deliveryMode: z.enum(["external", "internal"]).default("external"),
  provider: z.enum(["google_form", "microsoft_form", "manual", "internal", "other"]),
  formUrl: z.string().url().optional(),
  embedMode: z.enum(["iframe", "new_tab", "disabled"]).optional(),
  assessmentComponentType: z.enum(["diagnostic", "frequent", "periodic", "final"]),
  assessmentCloCodes: z.array(z.string().trim().min(1).max(50)).default([]),
  maxScore: z.number().positive().optional(),
  attemptLimit: z.number().int().positive().optional(),
  shuffleQuestions: z.boolean().optional(),
  showFeedbackAfterSubmit: z.boolean().optional(),
  timeLimitMinutes: z.number().int().positive().optional(),
  openAt: isoDatetimeSchema.optional(),
  dueAt: isoDatetimeSchema.optional(),
  status: z.enum(["draft", "open", "closed", "archived"]).optional(),
});

export const listAssessmentsForManagerSchema = z.object({
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  classId: z.string().uuid().optional(),
});

export const updateAssessmentStatusSchema = z.object({
  assessmentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
  status: z.enum(["draft", "open", "closed", "archived"]),
});

export const deleteAssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
});

export const listAssessmentsForStudentSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid().optional(),
});

export const getAssessmentForStudentSchema = z.object({
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
});
