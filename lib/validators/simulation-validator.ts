import { z } from "zod";

export const listSimulationsForCourseSchema = z.object({
  courseId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
});
