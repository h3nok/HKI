/**
 * Role-Based Access Control (RBAC) System
 * Shared with the client so labels, hierarchy, and permission checks stay aligned.
 */

import {
  hasAllPermissions as sharedHasAllPermissions,
  hasAnyPermission as sharedHasAnyPermission,
  hasPermission as sharedHasPermission,
  isRoleHigherOrEqual as sharedIsRoleHigherOrEqual,
  ROLE_PERMISSIONS,
  type Permission,
  type Role,
} from "@shared/access-control";

export type { Permission, Role };
export { ROLE_PERMISSIONS };

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  return sharedHasPermission(role, permission);
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: Role,
  permissions: Permission[]
): boolean {
  return sharedHasAnyPermission(role, permissions);
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(
  role: Role,
  permissions: Permission[]
): boolean {
  return sharedHasAllPermissions(role, permissions);
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Permission middleware for Express routes
 */
export function requirePermission(permission: Permission) {
  return (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!hasPermission(user.role, permission)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `This action requires the '${permission}' permission`,
      });
    }

    next();
  };
}

/**
 * Permission middleware that requires any of the specified permissions
 */
export function requireAnyPermission(permissions: Permission[]) {
  return (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!hasAnyPermission(user.role, permissions)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `This action requires one of: ${permissions.join(", ")}`,
      });
    }

    next();
  };
}

/**
 * Role hierarchy check (for role-based access)
 */
export function isRoleHigherOrEqual(
  userRole: Role,
  requiredRole: Role
): boolean {
  return sharedIsRoleHigherOrEqual(userRole, requiredRole);
}

/**
 * Minimum role middleware
 */
export function requireMinimumRole(requiredRole: Role) {
  return (req: any, res: any, next: any) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!isRoleHigherOrEqual(user.role, requiredRole)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `This action requires at least '${requiredRole}' role`,
      });
    }

    next();
  };
}
