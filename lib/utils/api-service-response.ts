import { NextResponse } from "next/server";

import type { ServiceResult } from "@/lib/types/service-result";

function getStatusCode(errorCode: string): number {
  switch (errorCode) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
      return 400;
    case "CONFLICT":
      return 409;
    case "EXTERNAL_PROVIDER_ERROR":
      return 502;
    case "STORAGE_ERROR":
      return 500;
    default:
      return 500;
  }
}

/**
 * Converts ServiceResult into a consistent JSON API response.
 */
export function toApiResponse<T>(
  result: ServiceResult<T>,
  successStatus = 200,
): NextResponse {
  if (result.ok) {
    return NextResponse.json(result.data, { status: successStatus });
  }

  return NextResponse.json(
    {
      error: result.error,
    },
    {
      status: getStatusCode(result.error.code),
    },
  );
}
