import type { AssessmentStatus } from "@/lib/types/assessment";
import type { QuestionType } from "@/lib/types/question-bank";

export type AssessmentAttemptStatus =
  | "in_progress"
  | "submitted"
  | "auto_graded"
  | "graded"
  | "abandoned"
  | "expired";

export type AssessmentQuestionSnapshot = {
  questionBankItemId: string;
  sortOrder: number;
  prompt: string;
  questionType: QuestionType;
  choices: string[];
  answerKey: unknown;
  explanation: string | null;
  points: number;
};

export type InternalAssessmentDefinition = {
  assessmentId: string;
  classId: string;
  classCode: string;
  classTitle: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  title: string;
  description?: string;
  status: AssessmentStatus;
  attemptLimit: number;
  shuffleQuestions: boolean;
  showFeedbackAfterSubmit: boolean;
  timeLimitMinutes?: number;
  openAt?: string;
  dueAt?: string;
  questions: AssessmentQuestionSnapshot[];
};

export type AssessmentAttemptSummary = {
  id: string;
  assessmentId: string;
  studentId: string;
  attemptNumber: number;
  status: AssessmentAttemptStatus;
  startedAt: string;
  submittedAt?: string;
  expiresAt?: string;
  autoGradedAt?: string;
  gradedAt?: string;
  metadata: Record<string, unknown>;
};

export type AssessmentAnswerRecord = {
  attemptId: string;
  assessmentId: string;
  questionBankItemId: string;
  sortOrder: number;
  answerPayload: Record<string, unknown>;
  answeredAt?: string;
  isFinal: boolean;
};

export type AssessmentAnswerScoreRecord = {
  attemptId: string;
  questionBankItemId: string;
  autoScore?: number;
  manualScore?: number;
  finalScore?: number;
  graderId?: string;
  feedback?: string;
  gradedAt?: string;
};

export type StudentAssessmentAttemptView = {
  attempt: AssessmentAttemptSummary | null;
  answers: AssessmentAnswerRecord[];
};

export type AssessmentAnswerScoreView = {
  attemptId: string;
  questionBankItemId: string;
  autoScore?: number;
  manualScore?: number;
  finalScore?: number;
  graderId?: string;
  feedback?: string;
  gradedAt?: string;
};

export type AssessmentAttemptGradingView = {
  attempt: AssessmentAttemptSummary;
  studentId: string;
  studentFullName: string;
  studentEmail?: string;
  studentCode?: string;
  studentIdentifier: string;
  answers: AssessmentAnswerRecord[];
  scores: AssessmentAnswerScoreView[];
};

export type StudentAssessmentQuestionReview = {
  questionBankItemId: string;
  sortOrder: number;
  prompt: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | "essay";
  selectionMode?: "single" | "multiple";
  choices: string[];
  points: number;
  answerText?: string;
  finalScore?: number;
  feedback?: string;
  explanation?: string | null;
};

export type StudentAssessmentReview = {
  attemptId: string;
  attemptNumber: number;
  status: AssessmentAttemptStatus;
  submittedAt?: string;
  gradedAt?: string;
  rawScore: number;
  maxScore: number;
  normalizedScore?: number;
  pendingManualReview: boolean;
  questions: StudentAssessmentQuestionReview[];
};
