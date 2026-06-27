export type CourseStatus = "draft" | "active" | "archived";

export type CourseVisibility = "private" | "unlisted" | "public_preview";

export type CourseKnowledgeBlock = "general" | "foundation" | "major";

export type CourseType = "required" | "elective";

export type CourseCloItem = {
  code: string;
  description: string;
};

export type CourseAssessmentComponent = {
  type: string;
  weight: number;
};

export type CourseModeratorOption = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export type CourseTeacherOption = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export type CourseTeacherAssignment = {
  id: string;
  fullName: string | null;
  email: string | null;
};

export type CourseSummary = {
  id: string;
  ownerId: string;
  ownerFullName: string | null;
  ownerRole: "admin" | "moderator" | "teacher" | "student" | null;
  code: string;
  title: string;
  description: string | null;
  visibility: CourseVisibility;
  status: CourseStatus;
  credits: number | null;
  knowledgeBlock: CourseKnowledgeBlock | null;
  courseType: CourseType | null;
  cloItems: CourseCloItem[];
  assessmentComponents: CourseAssessmentComponent[];
  assignedTeachers?: CourseTeacherAssignment[];
  createdAt: string;
  updatedAt: string;
};

export type CourseChangeRequest = {
  id: string;
  action: "create" | "update" | "archive" | "delete";
  targetCourseId: string | null;
  targetCodeSnapshot: string;
  targetTitleSnapshot: string;
  requestedCode: string | null;
  requestedTitle: string | null;
  requestedDescription: string | null;
  requestedVisibility: CourseVisibility | null;
  requestedStatus: CourseStatus | null;
  requestedCredits: number | null;
  requestedKnowledgeBlock: CourseKnowledgeBlock | null;
  requestedCourseType: CourseType | null;
  requestedCloItems: CourseCloItem[];
  requestedAssessmentComponents: CourseAssessmentComponent[];
  assignedModeratorId: string | null;
  status: "pending_review" | "approved" | "rejected";
  reason: string | null;
  reviewNote: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};
