export type LibraryMaterialItem = {
  id: string;
  courseId: string | null;
  uploadedBy: string;
  courseCode: string;
  courseTitle: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  description: string | null;
  sectionLabel: string | null;
  tags: string[];
  fileType: string;
  fileSize: number;
  allowDownload: boolean;
  status: "draft" | "published" | "archived";
  reviewStatus: "pending_review" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
};

export type LibrarySimulationItem = {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  categoryId: string | null;
  categoryName: string | null;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  createdAt: string;
};

export type LibraryCategoryItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  status: "active" | "archived";
  createdAt: string;
};

export type LibrarySimulationUploadReviewStatus = "pending_review" | "approved" | "rejected";

export type LibrarySimulationNativeIntegrationStatus = "not_requested" | "requested" | "accepted" | "rejected";

export type LibrarySimulationUploadItem = {
  id: string;
  uploadedBy: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  description: string | null;
  originalFileName: string;
  fileType: string;
  fileSize: number;
  tags: string[];
  requestedCourseId: string | null;
  requestedCourseCode: string | null;
  requestedCourseTitle: string | null;
  reviewStatus: LibrarySimulationUploadReviewStatus;
  nativeIntegrationStatus: LibrarySimulationNativeIntegrationStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

export type LibraryChangeRequestStatus = "pending_review" | "approved" | "rejected";

export type LibraryChangeRequestTargetType = "material" | "simulation";

export type LibraryChangeRequestItem = {
  id: string;
  targetType: LibraryChangeRequestTargetType;
  targetId: string;
  action: "archive" | "delete";
  targetTitleSnapshot: string;
  targetCourseLabelSnapshot: string | null;
  status: LibraryChangeRequestStatus;
  reason: string | null;
  reviewNote: string | null;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type LibraryOverview = {
  categories: LibraryCategoryItem[];
  materials: LibraryMaterialItem[];
  simulations: LibrarySimulationItem[];
  simulationUploads: LibrarySimulationUploadItem[];
  changeRequests: LibraryChangeRequestItem[];
  personalLibrary?: {
    quotaBytes: number;
    usedBytes: number;
    remainingBytes: number;
  };
  pendingWorkflow: {
    uploadPolicy: string;
    linkPolicy: string;
    deletePolicy: string;
  };
  vl6IntegrationReview: {
    fileName: string;
    verdict: "integratable_with_refactor" | "not_recommended_as_raw_embed";
    summary: string;
    risks: string[];
    recommendedSteps: string[];
  };
};
