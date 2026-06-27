export type ClassResourceActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialClassResourceActionState: ClassResourceActionState = {
  status: "idle",
};
