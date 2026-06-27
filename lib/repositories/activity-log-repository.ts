import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";

export type ActivityLogEntityType =
  | "course"
  | "class"
  | "material"
  | "assessment"
  | "submission"
  | "profile"
  | "enrollment_request"
  | "permission_scope";

export type CreateActivityLogInput = {
  actorId?: string;
  action: string;
  entityType: ActivityLogEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Writes activity logs for critical governance actions. Log failures should not block business actions.
 */
export async function createActivityLogRepository(input: CreateActivityLogInput): Promise<void> {
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("activity_logs").insert({
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    throw error;
  }
}

/**
 * Writes activity logs with service-role privileges for background/webhook flows.
 */
export async function createSystemActivityLogRepository(input: CreateActivityLogInput): Promise<void> {
  const supabase = createServiceRoleSupabaseClient();

  const { error } = await supabase.from("activity_logs").insert({
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    throw error;
  }
}
