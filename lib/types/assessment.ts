export type AssessmentProvider = "google_form" | "microsoft_form" | "manual" | "internal" | "other";

export type AssessmentDeliveryMode = "external" | "internal";

export type AssessmentEmbedMode = "iframe" | "new_tab" | "disabled";

export type AssessmentStatus = "draft" | "open" | "closed" | "archived";

export type AssessmentComponentType = "diagnostic" | "frequent" | "periodic" | "final";

export type StudentAssessmentListStatus = "available" | "completed" | "overdue" | "upcoming";

export type AssessmentSummary = {
  id: string;
  classId: string;
  courseId: string;
  classCode: string;
  classTitle: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description?: string;
  deliveryMode: AssessmentDeliveryMode;
  provider: AssessmentProvider;
  formUrl?: string;
  embedMode: AssessmentEmbedMode;
  assessmentComponentType?: AssessmentComponentType;
  assessmentCloCodes?: string[];
  attemptLimit: number;
  shuffleQuestions: boolean;
  showFeedbackAfterSubmit: boolean;
  timeLimitMinutes?: number;
  status: AssessmentStatus;
  openAt?: string;
  dueAt?: string;
  resultsLockedAt?: string;
  resultsLockedBy?: string;
  resultsPublishedAt?: string;
  resultsPublishedBy?: string;
  createdAt: string;
};

export type StudentAssessmentSummary = AssessmentSummary & {
  studentListStatus: StudentAssessmentListStatus;
};

export type StudentAssessmentView = {
  id: string;
  classId: string;
  classCode: string;
  classTitle: string;
  title: string;
  description?: string;
  deliveryMode: AssessmentDeliveryMode;
  provider: AssessmentProvider;
  formUrl?: string;
  embedMode: AssessmentEmbedMode;
  assessmentComponentType?: AssessmentComponentType;
  assessmentCloCodes?: string[];
  attemptLimit: number;
  shuffleQuestions: boolean;
  showFeedbackAfterSubmit: boolean;
  timeLimitMinutes?: number;
  status: AssessmentStatus;
  openAt?: string;
  dueAt?: string;
};

export type AssessmentAuthoringMode = {
  assessmentId: string;
  deliveryMode: AssessmentDeliveryMode;
  provider: AssessmentProvider;
  embedMode: AssessmentEmbedMode;
};
