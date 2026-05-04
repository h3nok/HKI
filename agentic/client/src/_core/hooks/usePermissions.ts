import { useAuthWithDevBypass } from "./useAuthWithDevBypass";
import {
  hasAllPermissions as hasAllRolePermissions,
  hasAnyPermission as hasAnyRolePermission,
  hasPermission as hasRolePermission,
  isRoleHigherOrEqual,
  ROLE_METADATA,
  type Permission,
  type Role,
} from "@shared/access-control";

export function usePermissions() {
  const { user } = useAuthWithDevBypass();
  const role = (user?.role as Role) || "viewer";

  const hasPermission = (permission: Permission): boolean => {
    return hasRolePermission(role, permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return hasAnyRolePermission(role, permissions);
  };

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return hasAllRolePermissions(role, permissions);
  };

  const isRole = (checkRole: Role): boolean => {
    return role === checkRole;
  };

  const isMinimumRole = (minimumRole: Role): boolean => {
    return isRoleHigherOrEqual(role, minimumRole);
  };

  return {
    role,
    roleMeta: ROLE_METADATA[role],
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isRole,
    isMinimumRole,
  };
}
