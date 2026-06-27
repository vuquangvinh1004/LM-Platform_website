import { z } from "zod";

export const createEnrollmentRequestsSchema = z.object({
  studentId: z.string().uuid(),
  requests: z
    .array(
      z.object({
        courseId: z.string().uuid(),
        classId: z.string().uuid().optional(),
      }),
    )
    .min(1)
    .max(50),
});

export const reviewEnrollmentRequestSchema = z.object({
  requestId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher"]),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional(),
});

export const reviewEnrollmentRequestsBatchSchema = z.object({
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher"]),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(1000).optional(),
  requests: z.array(z.object({ requestId: z.string().uuid() })).min(1).max(50),
});
