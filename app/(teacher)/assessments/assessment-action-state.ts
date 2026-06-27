export type AssessmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAssessmentActionState: AssessmentActionState = {
  status: "idle",
};
