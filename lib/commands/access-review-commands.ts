import {
  approveStudentAccess,
  grantScopedPermission,
  renewStudentAccess,
  revokeScopedPermission,
} from "@/lib/services/access-control-service";
import { reviewEnrollmentRequestsBatch } from "@/lib/services/enrollment-service";

export async function approveStudentAccessCommand(input: Parameters<typeof approveStudentAccess>[0]) {
  return approveStudentAccess(input);
}

export async function renewStudentAccessCommand(input: Parameters<typeof renewStudentAccess>[0]) {
  return renewStudentAccess(input);
}

export async function reviewEnrollmentBatchCommand(input: Parameters<typeof reviewEnrollmentRequestsBatch>[0]) {
  return reviewEnrollmentRequestsBatch(input);
}

export async function grantScopeCommand(input: Parameters<typeof grantScopedPermission>[0]) {
  return grantScopedPermission(input);
}

export async function revokeScopeCommand(input: Parameters<typeof revokeScopedPermission>[0]) {
  return revokeScopedPermission(input);
}
