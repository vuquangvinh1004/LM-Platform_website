import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { DirectMessage } from "@/lib/types/message";
import type { ClassroomDirectMessage } from "@/lib/types/classroom";

type DirectMessageRow = {
  id: string;
  class_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

type DirectMessageListRow = DirectMessageRow & {
  sender_profile: { full_name: string | null } | { full_name: string | null }[] | null;
  recipient_profile: { full_name: string | null } | { full_name: string | null }[] | null;
};

function firstProfileName(profile: { full_name: string | null } | { full_name: string | null }[] | null): string | null {
  if (Array.isArray(profile)) {
    return profile[0]?.full_name ?? null;
  }

  return profile?.full_name ?? null;
}

/**
 * Reads one class by id under RLS scope.
 */
export async function findClassForMessageRepository(classId: string): Promise<{ id: string; teacherId: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id,teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    teacherId: data.teacher_id,
  };
}

/**
 * Checks whether a profile is an active member of a class.
 */
export async function isActiveMemberOfClassRepository(classId: string, userId: string): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("class_members")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data?.id);
}

/**
 * Inserts one direct message in class scope.
 */
export async function createClassDirectMessageRepository(input: {
  classId: string;
  senderId: string;
  recipientId: string;
  content: string;
}): Promise<DirectMessage> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("direct_messages")
    .insert({
      class_id: input.classId,
      sender_id: input.senderId,
      recipient_id: input.recipientId,
      content: input.content,
    })
    .select("id,class_id,sender_id,recipient_id,content,created_at,read_at")
    .single();

  if (error) {
    throw error;
  }

  const row = data as DirectMessageRow;

  return {
    id: row.id,
    classId: row.class_id,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    content: row.content,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

/**
 * Lists recent direct messages for one actor inside one class.
 */
export async function listClassDirectMessagesRepository(input: {
  classId: string;
  actorId: string;
}): Promise<ClassroomDirectMessage[]> {
  const supabase = createServiceRoleSupabaseClient();
  const { data, error } = await supabase
    .from("direct_messages")
    .select(
      "id,class_id,sender_id,recipient_id,content,created_at,read_at,sender_profile:profiles!direct_messages_sender_id_fkey(full_name),recipient_profile:profiles!direct_messages_recipient_id_fkey(full_name)",
    )
    .eq("class_id", input.classId)
    .or(`sender_id.eq.${input.actorId},recipient_id.eq.${input.actorId}`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return ((data ?? []) as DirectMessageListRow[]).map((row) => ({
    id: row.id,
    classId: row.class_id,
    senderId: row.sender_id,
    senderName: firstProfileName(row.sender_profile),
    recipientId: row.recipient_id,
    recipientName: firstProfileName(row.recipient_profile),
    content: row.content,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

/**
 * Marks unread received direct messages as read for one actor inside one class.
 */
export async function markReceivedDirectMessagesAsReadRepository(input: {
  classId: string;
  actorId: string;
  senderId?: string;
}): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const readAt = new Date().toISOString();
  let query = supabase
    .from("direct_messages")
    .update({ read_at: readAt })
    .eq("class_id", input.classId)
    .eq("recipient_id", input.actorId)
    .is("read_at", null);

  if (input.senderId) {
    query = query.eq("sender_id", input.senderId);
  }

  const { data, error } = await query.select("id");

  if (error) {
    throw error;
  }

  return data?.length ?? 0;
}
