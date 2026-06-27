export type InternalAssessmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  attemptExpiresAt?: string;
  attemptStartedAt?: string;
  nonce: number;
};

export const initialInternalAssessmentActionState: InternalAssessmentActionState = {
  status: "idle",
  nonce: 0,
};
