import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ServiceResult } from "@/lib/types/service-result";

export type PersonalLibrarySnapshot = {
  teacherId: string;
  quotaBytes: number;
  usedBytes: number;
  remainingBytes: number;
};

function isMissingSimulationUploadsTable(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST205" || error.code === "42P01" || error.message?.includes("simulation_uploads") === true;
}

export async function getTeacherPersonalLibrarySnapshot(
  teacherId: string,
): Promise<ServiceResult<PersonalLibrarySnapshot>> {
  try {
    const supabase = createServiceRoleSupabaseClient();

    await supabase.rpc("ensure_personal_library_settings", {
      target_teacher_id: teacherId,
      actor_id: teacherId,
    });

    const [{ data: settings, error: settingsError }, { data: materials, error: materialsError }, simulationResult] = await Promise.all([
      supabase
        .from("personal_library_settings")
        .select("storage_quota_bytes,storage_used_bytes")
        .eq("teacher_id", teacherId)
        .single(),
      supabase
        .from("materials")
        .select("file_size")
        .eq("uploaded_by", teacherId)
        .is("course_id", null),
      supabase
        .from("simulation_uploads")
        .select("file_size")
        .eq("uploaded_by", teacherId)
        .is("requested_course_id", null),
    ]);

    if (settingsError) {
      throw settingsError;
    }

    if (materialsError) {
      throw materialsError;
    }

    if (simulationResult.error && !isMissingSimulationUploadsTable(simulationResult.error)) {
      throw simulationResult.error;
    }

    const materialBytes = (materials ?? []).reduce((total, item) => total + Number(item.file_size ?? 0), 0);
    const simulationBytes = (simulationResult.data ?? []).reduce((total, item) => total + Number(item.file_size ?? 0), 0);
    const usedBytes = materialBytes + simulationBytes;
    const quotaBytes = Number(settings.storage_quota_bytes ?? 0);
    const remainingBytes = Math.max(0, quotaBytes - usedBytes);

    if (Number(settings.storage_used_bytes ?? 0) !== usedBytes) {
      await supabase
        .from("personal_library_settings")
        .update({
          storage_used_bytes: usedBytes,
          updated_by: teacherId,
        })
        .eq("teacher_id", teacherId);
    }

    return {
      ok: true,
      data: {
        teacherId,
        quotaBytes,
        usedBytes,
        remainingBytes,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Không thể tải dung lượng Thư viện cá nhân.",
        details: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export async function ensureTeacherPersonalLibraryCapacity(input: {
  teacherId: string;
  incomingBytes: number;
}): Promise<ServiceResult<PersonalLibrarySnapshot>> {
  const snapshotResult = await getTeacherPersonalLibrarySnapshot(input.teacherId);

  if (!snapshotResult.ok) {
    return snapshotResult;
  }

  if (snapshotResult.data.usedBytes + input.incomingBytes > snapshotResult.data.quotaBytes) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "Thư viện cá nhân không đủ dung lượng cho tệp tải lên này.",
        details: {
          quotaBytes: snapshotResult.data.quotaBytes,
          usedBytes: snapshotResult.data.usedBytes,
          incomingBytes: input.incomingBytes,
        },
      },
    };
  }

  return snapshotResult;
}
