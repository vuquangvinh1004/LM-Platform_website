export type DashboardCompletionPoint = {
  assessmentId: string;
  assessmentTitle: string;
  classId: string;
  completionRate: number;
  completedCount: number;
  expectedCount: number;
  averageScore: number;
};

export type DashboardActivityItem = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type DashboardCourseOption = {
  id: string;
  code: string;
  title: string;
};

export type DashboardStudentMessageNotice = {
  id: string;
  classId: string;
  studentId: string;
  studentName: string | null;
  createdAt: string;
  replied: boolean;
};

export type DashboardClassOption = {
  id: string;
  classCode: string;
  title: string;
  courseId: string;
};

export type TeacherDashboardFilterInput = {
  courseId?: string;
  classId?: string;
};

export type TeacherDashboard = {
  totalCourses: number;
  totalClasses: number;
  totalStudents: number;
  totalAssessments: number;
  completionRate: number;
  completionSeries: DashboardCompletionPoint[];
  recentActivities: DashboardActivityItem[];
  studentMessageNotices: DashboardStudentMessageNotice[];
  selectedCourseId?: string;
  selectedClassId?: string;
  courses: DashboardCourseOption[];
  classes: DashboardClassOption[];
};
