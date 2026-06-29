import type { UserRole } from "@/lib/types/auth";

type UserRolePresentation = {
  badgeClassName: string;
  emphasisClassName: string;
  label: string;
  optionLabel: string;
};

const ROLE_PRESENTATION: Record<UserRole, UserRolePresentation> = {
  admin: {
    badgeClassName: "text-red-700",
    emphasisClassName: "font-semibold uppercase text-red-700",
    label: "QUẢN TRỊ VIÊN",
    optionLabel: "Quản trị viên",
  },
  moderator: {
    badgeClassName: "text-blue-700",
    emphasisClassName: "font-semibold uppercase text-blue-700",
    label: "GIÁM SÁT VIÊN",
    optionLabel: "Giám sát viên",
  },
  teacher: {
    badgeClassName: "text-emerald-700",
    emphasisClassName: "font-semibold uppercase text-emerald-700",
    label: "GIẢNG VIÊN",
    optionLabel: "Giảng viên",
  },
  student: {
    badgeClassName: "text-slate-700",
    emphasisClassName: "font-semibold uppercase text-slate-700",
    label: "SINH VIÊN",
    optionLabel: "Sinh viên",
  },
};

export function getUserRolePresentation(role: UserRole): UserRolePresentation {
  return ROLE_PRESENTATION[role];
}
