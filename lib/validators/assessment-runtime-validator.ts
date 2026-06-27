import { z } from "zod";

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const getAssessmentAuthoringModeSchema = z.object({
  assessmentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
});

export const getInternalAssessmentDefinitionSchema = getAssessmentAuthoringModeSchema;

export const getStudentAssessmentReviewSchema = z.object({
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export const startAssessmentAttemptSchema = z.object({
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export const getAssessmentAttemptForStudentSchema = z.object({
  assessmentId: z.string().uuid(),
  studentId: z.string().uuid(),
  attemptId: z.string().uuid().optional(),
});

export const saveAssessmentAnswerSchema = z.object({
  studentId: z.string().uuid(),
  attemptId: z.string().uuid(),
  assessmentId: z.string().uuid(),
  questionBankItemId: z.string().uuid(),
  sortOrder: z.number().int().positive(),
  answerPayload: jsonRecordSchema,
  isFinal: z.boolean().optional(),
});

export const submitAssessmentAttemptSchema = z.object({
  assessmentId: z.string().uuid(),
  attemptId: z.string().uuid(),
  studentId: z.string().uuid(),
});

export const teacherGradeAnswerSchema = z.object({
  attemptId: z.string().uuid(),
  questionBankItemId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher"]),
  autoScore: z.number().nonnegative().optional(),
  manualScore: z.number().nonnegative().optional(),
  finalScore: z.number().nonnegative().optional(),
  feedback: z.string().trim().max(4000).optional(),
});
