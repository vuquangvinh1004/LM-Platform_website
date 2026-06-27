import type { UserRole } from "@/lib/types/auth";

const teacherPaths = ["/dashboard", "/courses", "/materials", "/library", "/classes", "/assessments"];
const studentPaths = ["/my-classes", "/my-profile"];
const adminPaths = ["/admin"];
const accessReviewPaths = ["/access-review"];

const protectedPathPrefixes = [
  ...teacherPaths,
  ...studentPaths,
  ...adminPaths,
  ...accessReviewPaths,
];

/**
 * Next.js proxy matcher patterns derived from protected routes.
 * Keep in sync with protectedPathPrefixes so session/auth checks always run.
 */
export const proxyMatchers = [
  ...protectedPathPrefixes.map((prefix) => `${prefix}/:path*`),
  "/login",
];

export function isProtectedPath(pathname: string): boolean {
  return isPathMatch(pathname, protectedPathPrefixes);
}

export function isRoleAllowedForPath(pathname: string, role: UserRole): boolean {
  if (pathname === "/my-classes/materials" || pathname.startsWith("/my-classes/materials/")) {
    return role === "student" || role === "teacher" || role === "moderator" || role === "admin";
  }

  if (isPathMatch(pathname, adminPaths)) {
    return role === "admin";
  }

  if (isPathMatch(pathname, teacherPaths)) {
    return role === "teacher" || role === "admin" || role === "moderator";
  }

  if (isPathMatch(pathname, accessReviewPaths)) {
    return role === "admin" || role === "moderator";
  }

  if (isPathMatch(pathname, studentPaths)) {
    return role === "student" || role === "admin";
  }

  return true;
}

export function getDefaultPathForRole(role: UserRole): string {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "student") {
    return "/my-classes";
  }

  return "/dashboard";
}

function isPathMatch(pathname: string, basePaths: string[]): boolean {
  return basePaths.some((basePath) => pathname === basePath || pathname.startsWith(`${basePath}/`));
}
