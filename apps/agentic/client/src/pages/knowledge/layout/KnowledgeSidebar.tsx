/**
 * Knowledge Sidebar — Navigation, domain identity,
 * and user profile footer.
 *
 * Extracted from index.tsx for single-responsibility modularity.
 */

import { useCallback, useMemo } from "react";

import {
  MessageSquare,
  ChevronsUpDown,
  LogOut,
  Shield,
  Users,
  LifeBuoy,
} from "lucide-react";
import type { FeatureFlagKey } from "@shared/feature-flags";
import {
  cn,
  Avatar,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  HkiMark,
} from "@hki/ui";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  AppSidebarBrand,
  AppSidebarSectionLabel,
} from "@/components/ui/app-shell-primitives";
import { useAuth } from "@/_core/hooks/useAuth";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { usePermissions } from "@/_core/hooks/usePermissions";
import {
  buildChatWorkspaceHref,
  buildKnowledgeWorkspaceHref,
} from "@/_core/workspace-navigation";
import {
  canManageKnowledgeWorkspace,
  getAllowedKnowledgeTabs,
} from "@/_core/access/knowledge";
import { openBugReport } from "@/_core/support";
import { toast } from "sonner";
import { CHAPTER_ITEMS, INDEX_ITEMS } from "../types";
import { k } from "../theme";
import {
  getAvailableGovernSections,
  getAvailableKnowledgeTabs,
} from "../feature-gates";
import { useKB } from "../context/KnowledgeContext";
import { useLocation } from "wouter";

export default function KnowledgeSidebar() {
  const { user, logout } = useAuth();
  const { role } = usePermissions();
  const { canView: canViewFeature } = useFeatureAccess();
  const [, setLocation] = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const {
    tab,
    setTab,
    governSection,
    setGovernSection,
    selectedStream,
    streamLabel,
    isStreamLocked,
  } = useKB();
  const canAccessAdmin = role === "admin";
  const canManageKnowledge = canManageKnowledgeWorkspace(role);
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const allowedTabs = useMemo(
    () =>
      new Set(
        getAvailableKnowledgeTabs({
          allowedTabs: getAllowedKnowledgeTabs(role),
          canManageKnowledge,
          isEnabled: isFeatureEnabled,
        })
      ),
    [canManageKnowledge, isFeatureEnabled, role]
  );
  const availableGovernSections = useMemo(
    () => getAvailableGovernSections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const knowledgeHref = buildKnowledgeWorkspaceHref(selectedStream);
  const navGroupShell = isCollapsed ? "" : "px-1.5 py-1";
  const chatHref = buildChatWorkspaceHref(selectedStream);
  const footerCardClass = cn(
    "kb-sidebar-user-card relative overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-150"
  );
  const footerActionClass =
    "inline-flex items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary";
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleSignOut = async () => {
    try {
      await logout();
      window.location.replace("/login?from=knowledge");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const handleReportBug = () =>
    openBugReport({
      area: "Knowledge Domains",
      role,
      stream: selectedStream || "unselected",
    });

  const governIcon = CHAPTER_ITEMS.find(item => item.key === "govern")!.icon;
  const governNavItems = canManageKnowledge
    ? [
        ...(availableGovernSections.includes("review")
          ? [
              {
                key: "govern-review",
                label: "Review & Publish",
                icon: governIcon,
                isActive: tab === "govern" && governSection === "review",
                onClick: () => {
                  setGovernSection("review");
                  setTab("govern");
                },
              },
            ]
          : []),
        ...(availableGovernSections.includes("team")
          ? [
              {
                key: "govern-team",
                label: "Users & Access",
                icon: Users,
                isActive: tab === "govern" && governSection === "team",
                onClick: () => {
                  setGovernSection("team");
                  setTab("govern");
                },
              },
            ]
          : []),
        ...(availableGovernSections.includes("compliance")
          ? [
              {
                key: "govern-compliance",
                label: "Compliance",
                icon: Shield,
                isActive: tab === "govern" && governSection === "compliance",
                onClick: () => {
                  setGovernSection("compliance");
                  setTab("govern");
                },
              },
            ]
          : []),
      ]
    : [];
  const manageItems = [
    ...CHAPTER_ITEMS.filter(
      item => item.key !== "govern" && allowedTabs.has(item.key)
    ).map(item => ({
      key: item.key,
      label: item.label,
      icon: item.icon,
      isActive: tab === item.key,
      onClick: () => setTab(item.key),
    })),
    ...(allowedTabs.has("govern") ? governNavItems : []),
  ];
  const monitorItems = INDEX_ITEMS.filter(item => allowedTabs.has(item.key));

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className={cn(
        "kb-sidebar-shell border-r-0",
        // ── Sidebar surface — clean neutral with HKI Iris accent ──
        "[--sidebar-primary:var(--primary)]",
        "[--sidebar-primary-foreground:#ffffff] dark:[--sidebar-primary-foreground:#141820]",
        "**:data-[slot=sidebar-inner]:overflow-hidden",
        "**:data-[slot=sidebar-inner]:rounded-b-none",
        "**:data-[slot=sidebar-inner]:rounded-t-none"
      )}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER — Book Cover Emblem
          ═══════════════════════════════════════════════════════════════════ */}
      <SidebarHeader
        className={cn(
          "justify-center",
          isCollapsed ? "px-2 py-3" : "px-4 pt-4 pb-3"
        )}
      >
        <AppSidebarBrand
          href={knowledgeHref}
          onClick={e => {
            if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
              e.preventDefault();
              setTab("overview");
              setLocation(knowledgeHref);
            }
          }}
          collapsed={isCollapsed}
          eyebrow="Hermetic"
          title="Knowledge Domains"
          ariaLabel="Knowledge Domains Home"
          className="kb-sidebar-product-brand"
          icon={<HkiMark size={24} variant="color" />}
        />
      </SidebarHeader>

      {/* ═══════════════════════════════════════════════════════════════════
          NAVIGATION
          ═══════════════════════════════════════════════════════════════════ */}
      <SidebarContent
        className={cn("pt-0", isCollapsed ? "px-1" : "px-3 pb-4")}
      >
        {/* ── Domain ── */}
        {!isCollapsed && (
          <div className="px-3.5 pt-2 pb-1">
            <AppSidebarSectionLabel>
              Domain
            </AppSidebarSectionLabel>
          </div>
        )}

        <SidebarGroup className="py-0">
          <SidebarGroupContent className={navGroupShell}>
            <SidebarMenu className="gap-0.5">
              {manageItems.map(item => {
                const isActive = item.isActive;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      data-active={isActive ? "true" : "false"}
                      isActive={isActive}
                      onClick={item.onClick}
                      tooltip={item.label}
                      className={cn(
                        "dashboard-nav-button h-10 rounded-xl text-sm font-medium group/nav",
                        isCollapsed ? "justify-center px-0" : "px-3.5 gap-2.5",
                        isActive ? k.sidebarNavActive : k.sidebarNavIdle
                      )}
                    >
                      <span className="dashboard-nav-icon shrink-0">
                        <item.icon className="h-4 w-4 shrink-0 transition-colors duration-150" />
                      </span>
                      {!isCollapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Operations ── */}
        {!isCollapsed && (
          <div className="px-3.5 pt-4 pb-1">
            <AppSidebarSectionLabel>
              Operations
            </AppSidebarSectionLabel>
          </div>
        )}

        <SidebarGroup className="py-0">
          <SidebarGroupContent className={navGroupShell}>
            <SidebarMenu className="gap-0.5">
              {monitorItems.map(item => {
                const isActive = tab === item.key;
                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      data-active={isActive ? "true" : "false"}
                      isActive={isActive}
                      onClick={() => setTab(item.key)}
                      tooltip={item.label}
                      className={cn(
                        "dashboard-nav-button h-10 rounded-xl text-sm font-medium group/nav",
                        isCollapsed ? "justify-center px-0" : "px-3.5 gap-2.5",
                        isActive ? k.sidebarNavActive : k.sidebarNavIdle
                      )}
                    >
                      <span className="dashboard-nav-icon shrink-0">
                        <item.icon className="h-4 w-4 shrink-0 transition-colors duration-150" />
                      </span>
                      {!isCollapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER — Reader Profile
          ═══════════════════════════════════════════════════════════════════ */}
      <SidebarFooter className="border-t border-border/40 p-3.5">
        <SidebarMenu className="mb-2 gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleReportBug}
              tooltip="Open support"
              className={cn(
                "dashboard-nav-button rounded-xl border border-border/60 bg-card/70 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/8 hover:text-foreground",
                isCollapsed ? "h-10 justify-center px-0" : "h-10 gap-2.5 px-3"
              )}
            >
              <span className="dashboard-nav-icon shrink-0">
                <LifeBuoy className="h-4 w-4 shrink-0" />
              </span>
              {!isCollapsed && <span className="flex-1 truncate">Support</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          <SidebarMenuItem>
            {isStreamLocked ? (
              <div
                className={cn(
                  footerCardClass,
                  "flex items-center gap-2 px-2.5 py-2.5"
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/12 text-xs font-bold text-primary">
                      {user?.name ? getInitials(user.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-emerald-500" />
                </div>
                <div className="grid flex-1 min-w-0 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-foreground">
                    {user?.name || "User"}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email || ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className={footerActionClass}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className={cn(
                      footerCardClass,
                      "px-2.5 py-2.5",
                      "data-[state=open]:border-border/70 data-[state=open]:shadow-md"
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarFallback className="rounded-lg bg-primary/12 text-xs font-bold text-primary">
                          {user?.name ? getInitials(user.name) : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background bg-emerald-500" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {user?.name || "User"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.email || ""}
                      </span>
                    </div>
                    <span className="ml-auto inline-flex items-center justify-center rounded-lg p-1.5 text-muted-foreground transition-colors group-data-[state=open]:bg-primary/10 group-data-[state=open]:text-primary">
                      <ChevronsUpDown className="size-4" />
                    </span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl border border-border/60"
                  side="top"
                  align="end"
                  sideOffset={4}
                >
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
                      <Avatar className="h-9 w-9 rounded-xl ring-1 ring-border">
                        <AvatarFallback className="rounded-xl bg-primary/12 text-xs font-bold text-primary">
                          {user?.name ? getInitials(user.name) : "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold text-foreground">
                          {user?.name}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user?.email}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation(chatHref)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Open {streamLabel || "Chat"}
                  </DropdownMenuItem>
                  {canAccessAdmin && (
                    <DropdownMenuItem onClick={() => setLocation("/admin")}>
                      <Shield className="mr-2 h-4 w-4" />
                      Control Plane
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => void handleSignOut()}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
