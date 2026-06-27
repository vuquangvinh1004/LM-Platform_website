export type AuthActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectTo?: string;
};

export const initialAuthActionState: AuthActionState = {
  status: "idle",
};
