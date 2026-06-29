export type UserRole = "admin" | "moderator" | "teacher" | "student";

export type ProfileStatus = "active" | "inactive" | "archived";

export type StudentAccessStatus = "pending_approval" | "active" | "suspended" | "expired";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: ProfileStatus;
  access_status: StudentAccessStatus;
  access_expires_at: string | null;
  student_code: string | null;
  role_code: string | null;
  avatar_url: string | null;
};
