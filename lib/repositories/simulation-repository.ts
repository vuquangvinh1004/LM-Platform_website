import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { SimulationSummary } from "@/lib/types/simulation";

type SimulationRow = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  description: string | null;
  sort_order: number;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};

/**
 * Verifies course visibility under current actor session and returns minimal course info.
 */
export async function findCourseForSimulationRepository(courseId: string): Promise<{ id: string; title: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("courses").select("id,title").eq("id", courseId).maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    title: data.title,
  };
}

/**
 * Lists simulations for one visible course under RLS.
 */
export async function listSimulationsForCourseRepository(courseId: string): Promise<SimulationSummary[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("simulations")
    .select("id,course_id,slug,title,description,sort_order,status,created_at,updated_at")
    .eq("course_id", courseId)
    .neq("status", "archived")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as SimulationRow[]).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
