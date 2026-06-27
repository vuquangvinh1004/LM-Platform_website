import { createEnrollmentRequests } from "@/lib/services/enrollment-service";
import { getCurrentProfile } from "@/lib/services/auth-service";
import { toApiResponse } from "@/lib/utils/api-service-response";

type CreateEnrollmentRequestsBody = {
  requests: Array<{
    courseId: string;
    classId?: string;
  }>;
};

export async function POST(request: Request) {
  const profileResult = await getCurrentProfile();

  if (!profileResult.ok) {
    return toApiResponse(profileResult);
  }

  if (profileResult.data.role !== "student") {
    return toApiResponse({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Chỉ sinh viên mới được gửi yêu cầu đăng ký học phần.",
      },
    });
  }

  let body: CreateEnrollmentRequestsBody;
  try {
    body = (await request.json()) as CreateEnrollmentRequestsBody;
  } catch {
    return toApiResponse({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Body JSON không hợp lệ.",
      },
    });
  }

  const result = await createEnrollmentRequests({
    studentId: profileResult.data.id,
    requests: body.requests,
  });

  return toApiResponse(result, 201);
}
