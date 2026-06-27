export type MaterialUploadIntent = {
  courseId: string | null;
  storageBucket: "course-materials";
  storagePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
};

export type MaterialStatus = "draft" | "published" | "archived";

export type Material = {
  id: string;
  courseId: string | null;
  uploadedBy: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  sectionLabel: string | null;
  tags: string[];
  fileName: string;
  fileType: string;
  fileSize: number;
  storageBucket: string;
  storagePath: string;
  allowDownload: boolean;
  sortOrder: number;
  status: MaterialStatus;
  reviewStatus: "pending_review" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReadableMaterial = {
  id: string;
  title: string;
  fileType: string;
  viewUrl: string;
  downloadUrl?: string;
  allowDownload: boolean;
};
