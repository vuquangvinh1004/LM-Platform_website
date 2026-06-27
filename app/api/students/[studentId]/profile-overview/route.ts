import { requireRole } from "@/lib/services/auth-service";
import { getStudentProfileOverview } from "@/lib/services/student-profile-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

export async function GET(
  _request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  const profileResult = await requireRole(["admin", "moderator", "teacher", "student"]);

  if (!profileResult.ok) {
    return toApiResponse(profileResult);
  }

  const { studentId } = await context.params;

  const result = await getStudentProfileOverview({
    studentId,
    actorId: profileResult.data.id,
    actorRole: profileResult.data.role,
  });

  return toApiResponse(result);
}
