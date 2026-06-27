export type StudentProfileActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialStudentProfileActionState: StudentProfileActionState = {
  status: "idle",
};
