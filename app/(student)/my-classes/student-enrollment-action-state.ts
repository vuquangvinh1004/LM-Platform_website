export type StudentEnrollmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialStudentEnrollmentActionState: StudentEnrollmentActionState = {
  status: "idle",
};
