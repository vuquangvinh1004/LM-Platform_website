export type ClassroomAssignmentActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialClassroomAssignmentActionState: ClassroomAssignmentActionState = {
  status: "idle",
};
