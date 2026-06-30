export type AssessmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  nonce?: number;
};

export const initialAssessmentActionState: AssessmentActionState = {
  status: "idle",
};
