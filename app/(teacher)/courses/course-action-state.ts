export type CourseActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialCourseActionState: CourseActionState = {
  status: "idle",
};
