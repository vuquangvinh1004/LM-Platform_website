export type AccessStatus = "pending_approval" | "active" | "suspended" | "expired";

export type PermissionScopeType = "system" | "course" | "class";

export type PermissionScopeStatus = "active" | "revoked";

export type PermissionScope = {
  id: string;
  actorId: string;
  scopeType: PermissionScopeType;
  scopeId: string | null;
  permissions: Record<string, boolean>;
  status: PermissionScopeStatus;
  grantedBy: string;
  expiresAt: string | null;
  createdAt: string;
};

export type ScopedPermissionCheckResult = {
  allowed: boolean;
  reason?: string;
};
