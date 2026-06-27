import { NextResponse } from "next/server";

import { requireRole } from "@/lib/services/auth-service";
import { approveStudentAccess } from "@/lib/services/access-control-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

type ApproveRequestBody = {
  expiresAt?: string;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  const profileResult = await requireRole(["admin", "moderator", "teacher"]);

  if (!profileResult.ok) {
    return toApiResponse(profileResult);
  }

  const { studentId } = await context.params;

  let body: ApproveRequestBody = {};
  try {
    body = (await request.json()) as ApproveRequestBody;
  } catch {
    body = {};
  }

  const result = await approveStudentAccess({
    studentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
    expiresAt: body.expiresAt,
  });

  return toApiResponse(result);
}
