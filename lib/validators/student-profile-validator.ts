import { z } from "zod";

export const getStudentProfileOverviewSchema = z.object({
  studentId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
});
