export type GlobalNotificationStatus = "published" | "archived";
export type GlobalNotificationKind = "announcement" | "material_upload_request" | "material_upload_result";

export type GlobalNotificationItem = {
  id: string;
  title: string;
  content: string;
  status: GlobalNotificationStatus;
  audienceRoles: Array<"admin" | "moderator" | "teacher">;
  targetProfileIds: string[];
  createdByRole: "admin" | "moderator" | "teacher";
  createdBy: string;
  kind: GlobalNotificationKind;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};
