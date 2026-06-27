import type { AccessStatus } from "@/lib/types/access-control";

export type StudentProfileOverview = {
  personalInfo: {
    fullName: string;
    studentCode?: string;
    classLabel?: string;
    groupLabel?: string;
  };
  access: {
    accessStatus: AccessStatus;
    accessExpiresAt?: string;
  };
  summary: {
    totalAssessments: number;
    completedAssessments: number;
    averageScore?: number;
    weeklyActiveCount?: number;
    monthlyActiveCount?: number;
    totalAccessMinutes?: number;
  };
  courseBreakdown: Array<{
    courseId: string;
    courseCode: string;
    courseTitle: string;
    averageScore?: number;
    completedAssessments: number;
  }>;
  badges: Array<{
    badgeCode: string;
    badgeTitle: string;
    earnedAt?: string;
    source: "system" | "manual";
  }>;
};
