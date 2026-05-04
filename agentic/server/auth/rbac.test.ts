import { describe, it, expect } from "vitest";
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  isRoleHigherOrEqual,
  type Role,
  type Permission,
} from "./rbac";

describe("RBAC System", () => {
  describe("hasPermission", () => {
    it("should allow viewer to read chat", () => {
      expect(hasPermission("viewer", "chat:read")).toBe(true);
    });

    it("should not allow viewer to write chat", () => {
      expect(hasPermission("viewer", "chat:write")).toBe(false);
    });

    it("should not allow viewer to read knowledge", () => {
      expect(hasPermission("viewer", "knowledge:read")).toBe(false);
    });

    it("should allow operator to write chat", () => {
      expect(hasPermission("operator", "chat:write")).toBe(true);
    });

    it("should allow operator to read knowledge", () => {
      expect(hasPermission("operator", "knowledge:read")).toBe(true);
    });

    it("should allow operator to write knowledge", () => {
      expect(hasPermission("operator", "knowledge:write")).toBe(true);
    });

    it("should allow manager to configure agents", () => {
      expect(hasPermission("manager", "agents:configure")).toBe(true);
    });

    it("should allow manager to manage knowledge", () => {
      expect(hasPermission("manager", "knowledge:manage")).toBe(true);
    });

    it("should not allow manager to deploy agents", () => {
      expect(hasPermission("manager", "agents:deploy")).toBe(false);
    });

    it("should allow admin to deploy agents", () => {
      expect(hasPermission("admin", "agents:deploy")).toBe(true);
    });

    it("should allow admin to manage system", () => {
      expect(hasPermission("admin", "system:admin")).toBe(true);
    });

    it("should not allow operator to manage users", () => {
      expect(hasPermission("operator", "users:manage")).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has at least one permission", () => {
      expect(hasAnyPermission("operator", ["chat:write", "users:manage"])).toBe(
        true
      );
    });

    it("should return false if user has none of the permissions", () => {
      expect(hasAnyPermission("viewer", ["chat:write", "users:manage"])).toBe(
        false
      );
    });

    it("should return true if user has all permissions", () => {
      expect(hasAnyPermission("admin", ["chat:write", "users:manage"])).toBe(
        true
      );
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if user has all permissions", () => {
      expect(hasAllPermissions("admin", ["chat:read", "chat:write"])).toBe(
        true
      );
    });

    it("should return false if user is missing one permission", () => {
      expect(
        hasAllPermissions("operator", ["chat:write", "users:manage"])
      ).toBe(false);
    });

    it("should return true for empty permission list", () => {
      expect(hasAllPermissions("viewer", [])).toBe(true);
    });
  });

  describe("getRolePermissions", () => {
    it("should return all permissions for viewer", () => {
      const permissions = getRolePermissions("viewer");
      expect(permissions).toContain("chat:read");
      expect(permissions).toContain("agents:view");
      expect(permissions).not.toContain("knowledge:read");
      expect(permissions).not.toContain("chat:write");
    });

    it("should return all permissions for operator", () => {
      const permissions = getRolePermissions("operator");
      expect(permissions).toContain("chat:read");
      expect(permissions).toContain("chat:write");
      expect(permissions).toContain("tools:execute");
      expect(permissions).toContain("knowledge:read");
      expect(permissions).toContain("knowledge:write");
      expect(permissions).not.toContain("users:manage");
    });

    it("should return all permissions for manager", () => {
      const permissions = getRolePermissions("manager");
      expect(permissions).toContain("chat:delete");
      expect(permissions).toContain("agents:configure");
      expect(permissions).toContain("users:view");
      expect(permissions).toContain("knowledge:manage");
      expect(permissions).not.toContain("system:admin");
    });

    it("should return all permissions for admin", () => {
      const permissions = getRolePermissions("admin");
      expect(permissions).toContain("system:admin");
      expect(permissions).toContain("users:manage");
      expect(permissions).toContain("agents:deploy");
    });
  });

  describe("isRoleHigherOrEqual", () => {
    it("should return true for same role", () => {
      expect(isRoleHigherOrEqual("operator", "operator")).toBe(true);
    });

    it("should return true for higher role", () => {
      expect(isRoleHigherOrEqual("admin", "viewer")).toBe(true);
      expect(isRoleHigherOrEqual("manager", "operator")).toBe(true);
    });

    it("should return false for lower role", () => {
      expect(isRoleHigherOrEqual("viewer", "admin")).toBe(false);
      expect(isRoleHigherOrEqual("operator", "manager")).toBe(false);
    });

    it("should follow correct hierarchy", () => {
      // viewer < operator < manager < admin
      expect(isRoleHigherOrEqual("viewer", "viewer")).toBe(true);
      expect(isRoleHigherOrEqual("operator", "viewer")).toBe(true);
      expect(isRoleHigherOrEqual("manager", "viewer")).toBe(true);
      expect(isRoleHigherOrEqual("admin", "viewer")).toBe(true);

      expect(isRoleHigherOrEqual("viewer", "operator")).toBe(false);
      expect(isRoleHigherOrEqual("operator", "operator")).toBe(true);
      expect(isRoleHigherOrEqual("manager", "operator")).toBe(true);
      expect(isRoleHigherOrEqual("admin", "operator")).toBe(true);

      expect(isRoleHigherOrEqual("viewer", "manager")).toBe(false);
      expect(isRoleHigherOrEqual("operator", "manager")).toBe(false);
      expect(isRoleHigherOrEqual("manager", "manager")).toBe(true);
      expect(isRoleHigherOrEqual("admin", "manager")).toBe(true);

      expect(isRoleHigherOrEqual("viewer", "admin")).toBe(false);
      expect(isRoleHigherOrEqual("operator", "admin")).toBe(false);
      expect(isRoleHigherOrEqual("manager", "admin")).toBe(false);
      expect(isRoleHigherOrEqual("admin", "admin")).toBe(true);
    });
  });

  describe("Role Permissions Matrix", () => {
    it("should ensure viewer has minimal permissions", () => {
      const viewerPerms = getRolePermissions("viewer");
      expect(viewerPerms.length).toBe(5);
      expect(
        viewerPerms.every(p => p.includes(":view") || p === "chat:read")
      ).toBe(true);
    });

    it("should ensure operator can execute but not configure", () => {
      expect(hasPermission("operator", "tools:execute")).toBe(true);
      expect(hasPermission("operator", "tools:manage")).toBe(false);
      expect(hasPermission("operator", "agents:configure")).toBe(false);
      expect(hasPermission("operator", "knowledge:read")).toBe(true);
      expect(hasPermission("operator", "knowledge:write")).toBe(true);
    });

    it("should ensure manager can configure but not deploy", () => {
      expect(hasPermission("manager", "agents:configure")).toBe(true);
      expect(hasPermission("manager", "agents:deploy")).toBe(false);
      expect(hasPermission("manager", "guardrails:configure")).toBe(true);
      expect(hasPermission("manager", "knowledge:manage")).toBe(true);
    });

    it("should ensure admin has all permissions", () => {
      const adminPerms = getRolePermissions("admin");
      const allPossiblePerms: Permission[] = [
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
      ];
      allPossiblePerms.forEach(perm => {
        expect(adminPerms).toContain(perm);
      });
    });
  });
});
