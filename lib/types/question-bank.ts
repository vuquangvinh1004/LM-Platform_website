import type { SubmissionSource, SubmissionStatus } from "@/lib/types/submission";

export type QuestionType = "multiple_choice" | "true_false" | "short_answer" | "essay";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionBankItem = {
  id: string;
  courseId: string;
  createdBy: string;
  prompt: string;
  questionType: QuestionType;
  choices: string[];
  answerKey: unknown;
  explanation: string | null;
  difficulty: QuestionDifficulty;
  defaultPoints: number;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type CourseAssessmentResultItem = {
  id: string;
  courseId: string;
  classId: string;
  assessmentId: string;
  submissionId: string;
  studentId: string;
  studentIdentifier: string;
  attemptNumber: number;
  rawScore: number | null;
  maxScore: number | null;
  normalizedScore: number | null;
  status: SubmissionStatus;
  source: SubmissionSource;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
