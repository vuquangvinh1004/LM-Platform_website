import type { ProfileStatus, UserRole } from "@/lib/types/auth";

export type ManagedUserSummary = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: ProfileStatus;
  roleCode: string | null;
  studentCode: string | null;
  personalLibraryQuotaBytes: number | null;
  personalLibraryUsedBytes: number | null;
  createdAt: string;
};

export type ManagedStudentAccountSummary = {
  id: string;
  email: string;
  fullName: string;
  studentCode: string | null;
  status: ProfileStatus;
  createdAt: string;
  currentPassword: string | null;
};
