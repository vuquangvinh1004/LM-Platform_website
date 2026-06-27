import type { LibraryMaterialItem, LibrarySimulationItem } from "@/lib/types/library";

export type ClassResourceLinkTargetType = "material" | "simulation";

export type ClassResourceManagerData = {
  classId: string;
  classCode: string;
  classTitle: string;
  courseCode: string;
  courseTitle: string;
  materials: LibraryMaterialItem[];
  simulations: LibrarySimulationItem[];
  linkedMaterialIds: string[];
  linkedSimulationIds: string[];
};
