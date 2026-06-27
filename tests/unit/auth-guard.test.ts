import { describe, expect, it } from "vitest";

import {
  getDefaultPathForRole,
  isProtectedPath,
  isRoleAllowedForPath,
  proxyMatchers,
} from "@/lib/services/auth-guard";

describe("auth-guard", () => {
  it("detects protected paths", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/courses")).toBe(true);
    expect(isProtectedPath("/materials")).toBe(true);
    expect(isProtectedPath("/library")).toBe(true);
    expect(isProtectedPath("/classes")).toBe(true);
    expect(isProtectedPath("/assessments")).toBe(true);
    expect(isProtectedPath("/assessments/abc/results")).toBe(true);
    expect(isProtectedPath("/access-review")).toBe(true);
    expect(isProtectedPath("/my-classes")).toBe(true);
    expect(isProtectedPath("/my-profile")).toBe(true);
    expect(isProtectedPath("/admin")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
  });

  it("keeps proxy matchers aligned with protected paths", () => {
    const protectedPrefixes = [
      "/dashboard",
      "/courses",
      "/materials",
      "/library",
      "/classes",
      "/assessments",
      "/access-review",
      "/my-classes",
      "/my-profile",
      "/admin",
    ];

    for (const prefix of protectedPrefixes) {
      expect(proxyMatchers).toContain(`${prefix}/:path*`);
      expect(isProtectedPath(prefix)).toBe(true);
    }

    expect(proxyMatchers).toContain("/login");
  });

  it("enforces role access by path", () => {
    expect(isRoleAllowedForPath("/dashboard", "teacher")).toBe(true);
    expect(isRoleAllowedForPath("/dashboard", "moderator")).toBe(true);
    expect(isRoleAllowedForPath("/courses", "teacher")).toBe(true);
    expect(isRoleAllowedForPath("/materials", "teacher")).toBe(true);
    expect(isRoleAllowedForPath("/library", "teacher")).toBe(true);
    expect(isRoleAllowedForPath("/library", "moderator")).toBe(true);
    expect(isRoleAllowedForPath("/classes", "teacher")).toBe(true);
    expect(isRoleAllowedForPath("/classes", "student")).toBe(false);
    expect(isRoleAllowedForPath("/materials", "student")).toBe(false);
    expect(isRoleAllowedForPath("/library", "student")).toBe(false);
    expect(isRoleAllowedForPath("/courses", "student")).toBe(false);
    expect(isRoleAllowedForPath("/dashboard", "student")).toBe(false);
    expect(isRoleAllowedForPath("/my-classes", "student")).toBe(true);
    expect(isRoleAllowedForPath("/my-classes", "teacher")).toBe(false);
    expect(isRoleAllowedForPath("/admin", "admin")).toBe(true);
    expect(isRoleAllowedForPath("/admin", "teacher")).toBe(false);
  });

  it("returns sensible default redirect path by role", () => {
    expect(getDefaultPathForRole("admin")).toBe("/admin");
    expect(getDefaultPathForRole("student")).toBe("/my-classes");
    expect(getDefaultPathForRole("teacher")).toBe("/dashboard");
  });
});
