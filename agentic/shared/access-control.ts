export type Role = "admin" | "manager" | "operator" | "viewer";

export type Permission =
  | "chat:read"
  | "chat:write"
  | "chat:delete"
  | "agents:view"
  | "agents:configure"
  | "agents:deploy"
  | "tools:view"
  | "tools:execute"
  | "tools:manage"
  | "knowledge:read"
  | "knowledge:write"
  | "knowledge:manage"
  | "guardrails:view"
  | "guardrails:configure"
  | "analytics:view"
  | "analytics:export"
  | "users:view"
  | "users:manage"
  | "system:configure"
  | "system:admin";

export interface RoleMeta {
  code: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const ROLE_METADATA: Record<Role, RoleMeta> = {
  admin: {
    code: "PLATFORM_ADMIN",
    label: "Platform Admin",
    shortLabel: "Platform Admin",
    description:
      "Full platform governance, enterprise-wide user administration, and unrestricted stream access.",
  },
  manager: {
    code: "KB_ADMIN",
    label: "Knowledge Admin",
    shortLabel: "KB Admin",
    description:
      "Manages knowledge operations and member access for assigned value streams without platform-wide administration.",
  },
  operator: {
    code: "KB_OPERATOR",
    label: "Knowledge Operator",
    shortLabel: "KB Operator",
    description:
      "Uploads and curates content, and tests answers in assigned value streams without platform-wide administration.",
  },
  viewer: {
    code: "KB_USER",
    label: "Knowledge User",
    shortLabel: "KB User",
    description:
      "Standard scoped chat user with no direct Knowledge workspace access.",
  },
};

export const ALL_ROLES = ["admin", "manager", "operator", "viewer"] as const;

export const MANAGED_ROLES = ["manager", "operator", "viewer"] as const;

export type ManagedRole = (typeof MANAGED_ROLES)[number];

export const DEFAULT_STANDARD_ROLE: ManagedRole = "viewer";

export const ROLE_HIERARCHY: Record<Role, number> = {
  viewer: 1,
  operator: 2,
  manager: 3,
  admin: 4,
};

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: [
    "chat:read",
    "agents:view",
    "tools:view",
    "guardrails:view",
    "analytics:view",
  ],
  operator: [
    "chat:read",
    "chat:write",
    "agents:view",
    "tools:view",
    "tools:execute",
    "knowledge:read",
    "knowledge:write",
    "guardrails:view",
    "analytics:view",
  ],
  manager: [
    "chat:read",
    "chat:write",
    "chat:delete",
    "agents:view",
    "agents:configure",
    "tools:view",
    "tools:execute",
    "tools:manage",
    "knowledge:read",
    "knowledge:write",
    "knowledge:manage",
    "guardrails:view",
    "guardrails:configure",
    "analytics:view",
    "analytics:export",
    "users:view",
  ],
  admin: [
    "chat:read",
    "chat:write",
    "chat:delete",
    "agents:view",
    "agents:configure",
    "agents:deploy",
    "tools:view",
    "tools:execute",
    "tools:manage",
    "knowledge:read",
    "knowledge:write",
    "knowledge:manage",
    "guardrails:view",
    "guardrails:configure",
    "analytics:view",
    "analytics:export",
    "users:view",
    "users:manage",
    "system:configure",
    "system:admin",
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function hasAnyPermission(
  role: Role,
  permissions: Permission[]
): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

export function hasAllPermissions(
  role: Role,
  permissions: Permission[]
): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

export function isRoleHigherOrEqual(
  userRole: Role,
  requiredRole: Role
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function hasPlatformAdminAccess(role: Role | null | undefined): boolean {
  return role === "admin";
}

export function hasKnowledgeReadAccess(role: Role | null | undefined): boolean {
  return !!role && hasPermission(role, "knowledge:read");
}

export function hasKnowledgeWriteAccess(
  role: Role | null | undefined
): boolean {
  return !!role && hasPermission(role, "knowledge:write");
}

export function hasKnowledgeManageAccess(
  role: Role | null | undefined
): boolean {
  return !!role && hasPermission(role, "knowledge:manage");
}
