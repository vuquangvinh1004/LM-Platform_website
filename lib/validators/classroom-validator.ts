import { z } from "zod";

const actorRoleSchema = z.enum(["admin", "moderator", "teacher", "student"]);
const sessionResourceUrlSchema = z.string().trim().refine(
  (value) => {
    if (value.startsWith("/") && !value.startsWith("//")) {
      return true;
    }

    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },
  { message: "Liên kết phải là URL hợp lệ hoặc đường dẫn nội bộ." },
);

export const getClassroomLayoutSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
});

export const listClassAnnouncementsSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const createClassAnnouncementSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(5000),
});

export const createClassSessionSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
  title: z.string().trim().min(1).max(200),
});

export const updateClassSessionAccessSchema = z.object({
  classId: z.string().uuid(),
  sessionId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
  studentAccess: z.enum(["open", "locked", "scheduled"]),
  availableFrom: z.string().datetime().optional(),
});

export const createClassTemplateSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
});

export const listClassTemplatesSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
});

export const applyClassTemplateSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
  templateId: z.string().uuid(),
});

export const updateTeacherDeskNoteSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
  note: z.string().trim().max(5000).optional(),
});

export const getClassSessionSchema = z.object({
  classId: z.string().uuid(),
  sessionId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
});

export const updateClassSessionOverviewSchema = getClassSessionSchema.extend({
  title: z.string().trim().min(1).max(200),
  overviewContent: z.string().trim().max(10000).optional(),
  overviewObjectives: z.string().trim().max(10000).optional(),
});

export const appendClassSessionLectureItemSchema = getClassSessionSchema.extend({
  type: z.enum(["slide", "video", "audio", "reading"]),
  title: z.string().trim().min(1).max(200),
  url: sessionResourceUrlSchema.optional(),
  content: z.string().trim().max(10000).optional(),
});

export const appendClassSessionExtraMaterialSchema = getClassSessionSchema.extend({
  title: z.string().trim().min(1).max(200),
  url: sessionResourceUrlSchema.optional(),
  note: z.string().trim().max(5000).optional(),
});

export const appendClassSessionAssignmentSchema = getClassSessionSchema.extend({
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(10000).optional(),
  imageName: z.string().trim().max(255).optional(),
  imageDataUrl: z.string().trim().max(4_500_000).optional(),
});

export const appendClassSessionQuickReviewQuestionSchema = getClassSessionSchema.extend({
  type: z.enum(["multiple_choice", "multiple_answer"]),
  question: z.string().trim().min(1).max(1000),
  guidance: z.string().trim().max(5000).optional(),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  optionGuidances: z.array(z.string().trim().max(2000)).max(6).optional(),
  correctOptionIndexes: z.array(z.number().int().min(0).max(5)).min(1),
});

export const removeClassSessionItemSchema = getClassSessionSchema.extend({
  collection: z.enum(["lectureItems", "extraMaterials", "assignments", "quickReviewQuestions"]),
  itemId: z.string().uuid(),
});

export const listClassroomMaterialsSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
});

export const listClassroomSimulationsSchema = z.object({
  classId: z.string().uuid(),
  actorId: z.string().uuid(),
  actorRole: actorRoleSchema,
});
