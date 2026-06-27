export type ClassActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectTo?: string;
};

export const initialClassActionState: ClassActionState = {
  status: "idle",
};
