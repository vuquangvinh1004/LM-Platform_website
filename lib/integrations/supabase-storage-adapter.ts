import { createServerSupabaseClient, createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { ServiceResult } from "@/lib/types/service-result";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 10;

type CreateSignedMaterialUrlInput = {
  bucket: string;
  path: string;
  expiresInSeconds?: number;
  useServiceRole?: boolean;
};

/**
 * Creates short-lived signed URLs for private material objects after higher-level services verify access.
 */
export async function createSignedMaterialUrl(
  input: CreateSignedMaterialUrlInput,
): Promise<ServiceResult<string>> {
  try {
    const supabase = input.useServiceRole ? createServiceRoleSupabaseClient() : await createServerSupabaseClient();
    const { data, error } = await supabase.storage
      .from(input.bucket)
      .createSignedUrl(input.path, input.expiresInSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return {
        ok: false,
        error: {
          code: "STORAGE_ERROR",
          message: "Không thể tạo signed URL cho tài liệu.",
          details: error?.message,
        },
      };
    }

    return {
      ok: true,
      data: data.signedUrl,
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "STORAGE_ERROR",
        message: "Không thể tạo signed URL cho tài liệu.",
        details: error instanceof Error ? error.message : "Unknown storage error",
      },
    };
  }
}
