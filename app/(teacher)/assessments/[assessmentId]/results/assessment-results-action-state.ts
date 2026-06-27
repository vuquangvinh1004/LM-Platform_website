export type AssessmentGradingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  nonce: number;
};

export const initialAssessmentGradingActionState: AssessmentGradingActionState = {
  status: "idle",
  nonce: 0,
};

export type AssessmentResultsImportActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  nonce: number;
};

export const initialAssessmentResultsImportActionState: AssessmentResultsImportActionState = {
  status: "idle",
  nonce: 0,
};
