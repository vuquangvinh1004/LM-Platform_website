import { listOpenEnrollmentOptions } from "@/lib/services/enrollment-option-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

export async function GET() {
  const result = await listOpenEnrollmentOptions();
  return toApiResponse(result);
}
