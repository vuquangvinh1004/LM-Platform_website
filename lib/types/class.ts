export type ClassStatus = "draft" | "active" | "archived";
export type ClassMemberStatus = "active" | "inactive" | "removed";

export type CourseClassSummary = {
  id: string;
  courseId: string;
  teacherId: string;
  courseCode: string;
  courseTitle: string;
  classCode: string;
  title: string;
  semester: string | null;
  academicYear: string | null;
  status: ClassStatus;
  isOpenForEnrollment: boolean;
  autoApproveEnrollment: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClassMemberSummary = {
  id: string;
  classId: string;
  studentId: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  status: ClassMemberStatus;
  joinedAt: string;
};

export type AddStudentsResult = {
  added: number;
  skipped: number;
  needsReview: Array<{ row: number; reason: string }>;
};

export type ClassChangeRequest = {
  id: string;
  action: "create" | "archive" | "delete";
  targetClassId: string | null;
  courseId: string;
  classCode: string | null;
  title: string | null;
  semester: string | null;
  academicYear: string | null;
  requestedStatus: ClassStatus | null;
  requestedOpenForEnrollment?: boolean | null;
  status: "pending_review" | "approved" | "rejected";
  reason: string | null;
  reviewNote: string | null;
  requestedBy: string;
  requestedByName?: string | null;
  reviewedBy: string | null;
  reviewedByName?: string | null;
  reviewedAt: string | null;
  createdAt: string;
};
