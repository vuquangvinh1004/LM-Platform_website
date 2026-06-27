export type MaterialActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialMaterialActionState: MaterialActionState = {
  status: "idle",
};
