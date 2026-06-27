export type SimulationSummary = {
  id: string;
  courseId: string;
  slug: string;
  title: string;
  description: string | null;
  sortOrder: number;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
};
