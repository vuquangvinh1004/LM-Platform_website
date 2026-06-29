import type { CourseAssessmentComponent } from "@/lib/types/course";
import type { SubmissionSource, SubmissionStatus } from "@/lib/types/submission";

export type PublishedCourseAssessmentResultRow = {
  id: string;
  courseId: string;
  classId: string;
  assessmentId: string;
  submissionId: string;
  studentId: string;
  studentIdentifier: string;
  studentCode?: string;
  studentFullName: string;
  academicYear?: string;
  classCode?: string;
  classTitle?: string;
  assessmentComponentType?: "diagnostic" | "frequent" | "periodic" | "final";
  assessmentCloCodes: string[];
  cloScores: Record<string, number | undefined>;
  rawScore?: number;
  maxScore?: number;
  normalizedScore?: number;
  status: SubmissionStatus;
  source: SubmissionSource;
  submittedAt?: string;
  publishedAt?: string;
};

export type CourseAssessmentPublicationOverview = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  assessmentComponents: CourseAssessmentComponent[];
  publishedRows: PublishedCourseAssessmentResultRow[];
};
