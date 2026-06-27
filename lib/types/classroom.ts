export type ClassroomActorRole = "admin" | "moderator" | "teacher" | "student";

export type ClassroomClassInfo = {
  id: string;
  courseId: string;
  classCode: string;
  classTitle: string;
  courseCode: string;
  courseTitle: string;
  teacherId: string;
  teacherName: string | null;
  teacherEmail: string | null;
  teacherDeskNote: string | null;
};

export type ClassroomMemberRecord = {
  id: string;
  studentId: string;
  fullName: string;
  studentCode: string | null;
};

export type ClassroomSeat = {
  seatOrder: number;
  row: number;
  column: number;
  studentId: string;
  fullName: string;
  studentCode: string | null;
};

export type ClassroomAnnouncement = {
  id: string;
  classId: string;
  title: string;
  content: string;
  status: "published" | "archived";
  createdAt: string;
};

export type ClassroomDirectMessage = {
  id: string;
  classId: string;
  senderId: string;
  senderName: string | null;
  recipientId: string;
  recipientName: string | null;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type ClassroomMaterialItem = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  sectionLabel: string | null;
  categoryName: string | null;
  createdAt: string;
};

export type ClassroomSimulationItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  openUrl: string | null;
  createdAt: string;
};

export type ClassroomSessionStatus = "planned" | "completed" | "cancelled";
export type ClassroomSessionStudentAccess = "open" | "locked" | "scheduled";

export type ClassroomSessionSummary = {
  id: string;
  classId: string;
  sessionIndex: number;
  title: string;
  status: ClassroomSessionStatus;
  studentAccess: ClassroomSessionStudentAccess;
  availableFrom: string | null;
  isAccessibleToStudents: boolean;
  createdAt: string;
};

export type ClassroomSessionLectureType = "slide" | "video" | "audio" | "reading";

export type ClassroomSessionLectureItem = {
  id: string;
  type: ClassroomSessionLectureType;
  title: string;
  url?: string;
  content?: string;
};

export type ClassroomSessionExtraMaterial = {
  id: string;
  title: string;
  url?: string;
  note?: string;
};

export type ClassroomSessionAssignment = {
  id: string;
  title: string;
  instructions?: string;
  imageName?: string;
  imageDataUrl?: string;
};

export type ClassroomSessionQuickReviewQuestion = {
  id: string;
  type: "multiple_choice" | "multiple_answer";
  question: string;
  guidance?: string;
  options: Array<{
    id: string;
    label: string;
    guidance?: string;
    isCorrect: boolean;
  }>;
};

export type ClassroomSessionDetail = ClassroomSessionSummary & {
  classInfo: ClassroomClassInfo;
  overviewContent?: string;
  overviewObjectives?: string;
  lectureItems: ClassroomSessionLectureItem[];
  extraMaterials: ClassroomSessionExtraMaterial[];
  assignments: ClassroomSessionAssignment[];
  quickReviewQuestions: ClassroomSessionQuickReviewQuestion[];
};

export type ClassroomTemplateSummary = {
  id: string;
  courseId: string;
  sourceClassId: string | null;
  createdBy: string;
  name: string;
  description: string | null;
  teacherDeskNote: string | null;
  sessionCount: number;
  materialCount: number;
  simulationCount: number;
  createdAt: string;
};

export type ClassroomOpenAssessment = {
  id: string;
  title: string;
  dueAt: string | null;
};

export type ClassroomLayout = {
  classInfo: ClassroomClassInfo;
  seats: ClassroomSeat[];
  columns: number;
  rowsPerViewport: number;
};
