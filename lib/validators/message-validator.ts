import { z } from "zod";

export const classDirectMessageAccessSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: z.enum(["admin", "moderator", "teacher", "student"]),
});

export const markClassDirectMessagesAsReadSchema = classDirectMessageAccessSchema.extend({
  senderId: z.string().uuid().optional(),
});

export const sendClassDirectMessageSchema = z
  .object({
    ...classDirectMessageAccessSchema.shape,
    recipientId: z.string().uuid(),
    content: z.string().trim().min(1).max(3000),
  })
  .superRefine((value, context) => {
    if (value.actorId === value.recipientId) {
      context.addIssue({
        code: "custom",
        path: ["recipientId"],
        message: "Người nhận không được trùng với người gửi.",
      });
    }
  });
