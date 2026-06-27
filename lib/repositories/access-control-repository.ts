import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createActivityLogRepository } from "@/lib/repositories/activity-log-repository";

export type ScopedPermissionCheckRepositoryInput = {
  actorId: string;
  actorRole: "admin" | "moderator" | "teacher" | "student";
  resourceType: "course" | "class";
  resourceId: string;
  permission: string;
};

export type ApproveStudentAccessRepositoryInput = {
  studentId: string;
  actorId: string;
  expiresAt?: string;
};

export type RenewStudentAccessRepositoryInput = {
  studentId: string;
  actorId: string;
  expiresAt: string;
};

/**
 * Checks scope permission through database function to keep permission logic centralized.
 */
export async function checkScopedPermissionRepository(input: ScopedPermissionCheckRepositoryInput): Promise<boolean> {
  if (input.actorRole === "admin") {
    return true;
  }

  const supabase = await createServerSupabaseClient();
  const scopeType = input.resourceType;

  const { data, error } = await supabase.rpc("has_scope_permission", {
    target_scope_type: scopeType,
    target_scope_id: input.resourceId,
    required_permission: input.permission,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

/**
 * Activates student access once an authorized reviewer approves.
 */
export async function approveStudentAccessRepository(input: ApproveStudentAccessRepositoryInput): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("approve_student_access", {
    target_student_id: input.studentId,
    target_expires_at: input.expiresAt ?? null,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("STUDENT_PROFILE_NOT_UPDATED");
  }

  try {
    await createActivityLogRepository({
      actorId: input.actorId,
      action: "student.access.approved",
      entityType: "profile",
      entityId: input.studentId,
      metadata: {
        expiresAt: input.expiresAt ?? null,
      },
    });
  } catch {
    // Do not fail approval flow due to audit log write errors.
  }
}

/**
 * Extends student access expiry while preserving active access state.
 */
export async function renewStudentAccessRepository(input: RenewStudentAccessRepositoryInput): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase.rpc("renew_student_access", {
    target_student_id: input.studentId,
    target_expires_at: input.expiresAt,
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("STUDENT_PROFILE_NOT_UPDATED");
  }

  try {
    await createActivityLogRepository({
      actorId: input.actorId,
      action: "student.access.renewed",
      entityType: "profile",
      entityId: input.studentId,
      metadata: {
        expiresAt: input.expiresAt,
      },
    });
  } catch {
    // Do not fail renewal flow due to audit log write errors.
  }
}
