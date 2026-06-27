import type { ProfileStatus, UserRole } from "@/lib/types/auth";

export type ManagedUserSummary = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: ProfileStatus;
  teacherCode: string | null;
  studentCode: string | null;
  personalLibraryQuotaBytes: number | null;
  personalLibraryUsedBytes: number | null;
  createdAt: string;
};
