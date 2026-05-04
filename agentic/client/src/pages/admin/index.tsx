/**
 * Enterprise Hub — Layout Shell
 *
 * IPMS-style sidebar layout with grouped sections,
 * SidebarProvider + SidebarInset pattern, and PageShell content area.
 *
 * Routes: /admin, /admin/streams, /admin/users, /admin/settings,
 *         /admin/settings/presets
 * Auth: admin-only
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
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
  COSTCO_BLUE,
} from "@hki/ui";
import {
  LayoutDashboard,
  Layers,
  Users,
  BookOpen,
  MessageSquare,
  ArrowLeft,
  Bug,
  Shield,
  Sparkles,
  LogOut,
  ChevronsUpDown,
  ExternalLink,
  Moon,
  Sun,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { OpsIcon } from "@/components/ui/icons/OpsIcon";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { BreadcrumbBar } from "@/components/ui/breadcrumb-bar";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { openBugReport } from "@/_core/support";
import {
  APP_BUILD_INFO,
  APP_VERSION_LABEL,
  formatAppVersionTitle,
} from "@/_core/version";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageMeta } from "@/hooks/usePageMeta";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Search } from "lucide-react";
import DashboardPage from "./DashboardPage";
import StreamsPage from "./StreamsPage";
import UsersPage from "./UsersPage";
import FeatureControlsPage from "./FeatureControlsPage";
import FeaturePresetsPage from "./FeaturePresetsPage";
import { a } from "./theme";
import {
  AdminCommandPalette,
  type CommandItem,
} from "./components/AdminCommandPalette";

// ── Brand ────────────────────────────────────────────────────────────────────

// ── Navigation structure (IPMS pattern: grouped sections) ────────────────────

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  openInNewTab?: boolean;
  badgeKey?: string;
  shortcut?: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const SETTINGS_PATH = "/admin/settings";
const SETTINGS_PRESETS_PATH = "/admin/settings/presets";

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Command Center",
    items: [
      {
        icon: LayoutDashboard,
        label: "Overview",
        path: "/admin",
        shortcut: "⌘1",
      },
    ],
  },
  {
    label: "Governance",
    items: [
      {
        icon: Layers,
        label: "Value Streams",
        path: "/admin/streams",
        badgeKey: "streams",
        shortcut: "⌘2",
      },
      {
        icon: Users,
        label: "Users & Roles",
        path: "/admin/users",
        shortcut: "⌘3",
        adminOnly: true,
      },
    ],
  },
  {
    label: "Capabilities",
    items: [
      {
        icon: BookOpen,
        label: "Knowledge",
        path: "/knowledge",
        shortcut: "⌘4",
      },
      {
        icon: MessageSquare,
        label: "Agent Chat",
        path: "/chat",
        shortcut: "⌘5",
      },
    ],
  },
];

const SETTINGS_MENU_ITEMS: NavItem[] = [
  {
    icon: SlidersHorizontal,
    label: "Settings",
    path: SETTINGS_PATH,
    shortcut: "⌘7",
    adminOnly: true,
  },
  {
    icon: Sparkles,
    label: "Feature Flags",
    path: SETTINGS_PRESETS_PATH,
    shortcut: "⌘8",
    adminOnly: true,
  },
];

type AdminPage =
  | "dashboard"
  | "streams"
  | "users"
  | "features"
  | "featurePresets";

function resolvePageFromPath(pathname: string): AdminPage {
  if (pathname === SETTINGS_PRESETS_PATH) return "featurePresets";
  if (pathname === "/admin/streams") return "streams";
  if (pathname === "/admin/users") return "users";
  if (pathname === "/admin/features" || pathname === SETTINGS_PATH)
    return "features";
  return "dashboard";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN LAYOUT (entry point)
// ═══════════════════════════════════════════════════════════════════════════════

export default function AdminLayout() {
  const { role } = usePermissions();
  usePageMeta("Enterprise Hub — HKI Agentic", "/favicon-ops.svg");

  const isAdmin = role === "admin";

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center space-y-3">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-lg font-semibold text-foreground">
            Access Restricted
          </p>
          <p className="text-sm text-muted-foreground max-w-sm">
            You need Platform Admin privileges to access the Enterprise Hub.
          </p>
          <a
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Chat
          </a>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AdminSidebar />
      <AdminContent />
    </SidebarProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR (glassmorphic, IPMS style)
// ═══════════════════════════════════════════════════════════════════════════════

function AdminSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { role } = usePermissions();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const isAdmin = role === "admin";

  const handleSignOut = async () => {
    try {
      await logout();
      window.location.replace("/login");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  // #1 — Live count badges
  const streamsQ = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
  });
  const badgeCounts: Record<string, number> = {
    streams: (streamsQ.data ?? []).filter((s: any) => s.id !== "global").length,
  };

  // #2 — Platform health (reuse governance stats)
  const healthQ = trpc.governance.stats.useQuery(undefined, {
    retry: false,
    refetchInterval: 60_000,
  });
  const isHealthy = healthQ.data ? healthQ.data.guardrailBlocks === 0 : true;
  const settingsMenuItems = SETTINGS_MENU_ITEMS.filter(
    item => !item.adminOnly || isAdmin
  );

  const handleReportBug = () =>
    openBugReport({
      area: "Enterprise Hub",
      role,
      path: `${location}${window.location.search}`,
    });

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "admin-sidebar-shell",
        isCollapsed
          ? "admin-sidebar-shell--collapsed"
          : "admin-sidebar-shell--expanded",
        "border-r-0 bg-transparent shadow-none"
      )}
    >
      {/* ── Header: Brand mark ── */}
      <SidebarHeader
        className={cn(
          "justify-center",
          isCollapsed ? "px-0 py-3" : "px-4 pt-5 pb-3"
        )}
      >
        <button
          onClick={() => setLocation("/admin")}
          className={cn(
            "admin-sidebar-brand-card group/brand flex items-center border transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isCollapsed
              ? "w-full justify-center rounded-[22px] px-0 py-3"
              : "gap-3 rounded-[26px] px-3 py-3.5"
          )}
          aria-label="Enterprise Hub Home"
        >
          <div className="relative shrink-0">
            <OpsIcon size={isCollapsed ? 32 : 38} />
            {/* #2 — Platform health dot */}
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                isHealthy ? "bg-primary" : "bg-amber-500 animate-pulse"
              )}
              title={
                isHealthy
                  ? "All systems operational"
                  : "Platform needs attention"
              }
            />
          </div>
          {!isCollapsed && (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className="text-[15px] font-bold leading-tight tracking-tight"
                style={{ color: COSTCO_BLUE }}
              >
                Enterprise Hub
              </span>
              <span className="admin-sidebar-brand-subtitle">
                HKI Agentic
              </span>
            </div>
          )}
        </button>
      </SidebarHeader>

      {/* ── Navigation groups ── */}
      <SidebarContent className={cn("pt-0", isCollapsed ? "px-1" : "px-3")}>
        {NAV_GROUPS.map((group, gi) => (
          <SidebarGroup key={group.label} className="py-1">
            {/* #3 — Section divider (skip first group) */}
            {gi > 0 && !isCollapsed && (
              <div className="px-4 pt-1 pb-0.5">
                <div className="h-px bg-border" />
              </div>
            )}
            {gi > 0 && isCollapsed && (
              <div className="px-2 pt-1 pb-0.5">
                <div className="h-px bg-border/70" />
              </div>
            )}
            {/* Section label */}
            {!isCollapsed && (
              <div className="px-2 pt-2 pb-1.5">
                <span className={a.sectionLabel}>{group.label}</span>
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items
                  .filter(item => !item.adminOnly || isAdmin)
                  .map(item => {
                    const isExternal =
                      item.path.startsWith("http://") ||
                      item.path.startsWith("https://");
                    const opensInNewTab = Boolean(
                      isExternal || item.openInNewTab
                    );
                    const isActive =
                      !opensInNewTab &&
                      (item.path === "/admin"
                        ? location === "/admin" || location === "/admin/"
                        : item.path === SETTINGS_PATH
                          ? location === SETTINGS_PATH
                          : location === item.path ||
                            location.startsWith(item.path + "/"));

                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => {
                            if (opensInNewTab) {
                              window.open(
                                item.path,
                                "_blank",
                                "noopener,noreferrer"
                              );
                            } else {
                              setLocation(item.path);
                            }
                          }}
                          tooltip={item.label}
                          className={cn(
                            "dashboard-nav-button admin-sidebar-nav-button text-sm font-medium group/nav",
                            isCollapsed
                              ? "h-11 w-11 justify-center rounded-2xl px-0"
                              : "h-11 rounded-2xl gap-3 px-3 py-2",
                            isActive && "font-semibold"
                          )}
                        >
                          <span className="admin-sidebar-nav-rail" />
                          <span className="dashboard-nav-icon admin-sidebar-nav-icon shrink-0">
                            <item.icon className="h-4 w-4 shrink-0 transition-transform duration-300" />
                          </span>
                          {!isCollapsed && (
                            <span className="admin-sidebar-nav-label flex-1 truncate">
                              {item.label}
                            </span>
                          )}
                          {/* #1 — Count badge */}
                          {!isCollapsed &&
                            item.badgeKey &&
                            badgeCounts[item.badgeKey] != null && (
                              <span className="dashboard-nav-badge admin-sidebar-nav-badge ml-auto min-w-5 text-center text-[9px] font-bold tabular-nums">
                                {badgeCounts[item.badgeKey]}
                              </span>
                            )}
                          {/* #4 — Keyboard shortcut hint */}
                          {!isCollapsed &&
                            item.shortcut &&
                            !item.badgeKey &&
                            !opensInNewTab && (
                              <span className="dashboard-nav-shortcut admin-sidebar-nav-shortcut ml-auto text-[9px] font-mono">
                                {item.shortcut}
                              </span>
                            )}
                          {opensInNewTab && !isCollapsed && (
                            <ExternalLink className="dashboard-nav-external admin-sidebar-nav-external w-3 h-3" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── Footer: User profile ── */}
      {!isCollapsed && (
        <div className="mx-4">
          <div className="h-px bg-border" />
        </div>
      )}
      <SidebarFooter className="p-3">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleReportBug}
              tooltip="Report Bug"
              className={cn(
                "dashboard-nav-button admin-sidebar-nav-button text-sm font-semibold group/nav",
                "border border-red-500/20 bg-red-500/8 text-red-600 hover:bg-red-500/12 hover:text-red-700",
                "dark:text-red-400 dark:hover:text-red-300",
                isCollapsed
                  ? "h-11 w-11 justify-center rounded-2xl px-0"
                  : "h-10 rounded-2xl gap-3 px-3 py-2"
              )}
            >
              <span className="admin-sidebar-nav-rail" />
              <span className="dashboard-nav-icon admin-sidebar-nav-icon shrink-0">
                <Bug className="h-4 w-4 shrink-0 transition-transform duration-300" />
              </span>
              {!isCollapsed && (
                <span className="admin-sidebar-nav-label flex-1 truncate">
                  Report Bug
                </span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className={cn(
                    "admin-sidebar-user-card",
                    "rounded-[22px] px-2.5 py-2.5",
                    "transition-all duration-200"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-8 w-8 rounded-xl ring-1 ring-border">
                      <AvatarFallback
                        className="rounded-xl text-[10px] font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${COSTCO_BLUE}, ${COSTCO_BLUE}dd)`,
                        }}
                      >
                        {user?.name ? getInitials(user.name) : "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card"
                      style={{
                        backgroundColor: isHealthy ? COSTCO_BLUE : "#f59e0b",
                      }}
                    />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {user?.name || "User"}
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="admin-sidebar-user-role">
                        {isAdmin ? "Admin" : "Manager"}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground/72">
                        {user?.email || ""}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground/40" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl"
                side="top"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2.5 px-2 py-2 text-left text-sm">
                    <Avatar className="h-9 w-9 rounded-xl ring-1 ring-border">
                      <AvatarFallback
                        className="rounded-xl text-xs font-bold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${COSTCO_BLUE}, ${COSTCO_BLUE}dd)`,
                        }}
                      >
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
                <DropdownMenuItem onClick={() => setLocation("/chat")}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Open Chat
                </DropdownMenuItem>
                {settingsMenuItems.length > 0 && <DropdownMenuSeparator />}
                {settingsMenuItems.map(item => (
                  <DropdownMenuItem
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {item.shortcut}
                      </span>
                    )}
                  </DropdownMenuItem>
                ))}
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* #5 — Version/build tag */}
      {!isCollapsed && (
        <div className="px-4 pb-2">
          <p
            className="admin-sidebar-build-tag text-center"
            title={formatAppVersionTitle("Enterprise Hub", APP_BUILD_INFO)}
          >
            {APP_VERSION_LABEL}
          </p>
        </div>
      )}

      <SidebarRail />
    </Sidebar>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// THEME TOGGLE
// ═══════════════════════════════════════════════════════════════════════════════

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className={cn(
        a.toolbarIconButton,
        "inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
      )}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT AREA (SidebarInset)
// ═══════════════════════════════════════════════════════════════════════════════

const ADMIN_PAGE_META: Record<
  AdminPage,
  { title: string; group?: string; groupPath?: string }
> = {
  dashboard: {
    title: "Overview",
  },
  streams: {
    title: "Value Streams",
    group: "Governance",
    groupPath: "/admin",
  },
  users: {
    title: "Users & Roles",
    group: "Governance",
    groupPath: "/admin",
  },
  features: {
    title: "Settings",
  },
  featurePresets: {
    title: "Feature Flags",
    group: "Settings",
    groupPath: SETTINGS_PATH,
  },
};

function AdminContent() {
  const [location, setLocation] = useLocation();
  const { role } = usePermissions();
  const isAdmin = role === "admin";
  const [cmdOpen, setCmdOpen] = useState(false);

  const visibleNavGroups = useMemo(
    () =>
      NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.filter(item => !(item.adminOnly && !isAdmin)),
      })).filter(group => group.items.length > 0),
    [isAdmin]
  );
  const visibleSettingsMenuItems = useMemo(
    () => SETTINGS_MENU_ITEMS.filter(item => !(item.adminOnly && !isAdmin)),
    [isAdmin]
  );

  // Build command items from NAV_GROUPS
  const commandItems = useMemo<CommandItem[]>(() => {
    return visibleNavGroups
      .flatMap(group =>
        group.items.map(item => ({
          id: item.path,
          label: item.label,
          icon: item.icon,
          section: group.label,
          path: item.path,
          shortcut: item.shortcut,
        }))
      )
      .concat(
        visibleSettingsMenuItems.map(item => ({
          id: item.path,
          label: item.label,
          icon: item.icon,
          section: "Settings",
          path: item.path,
          shortcut: item.shortcut,
        }))
      );
  }, [visibleSettingsMenuItems, visibleNavGroups]);

  // Global ⌘K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);
  const activePage = resolvePageFromPath(location);
  const guardedPage = activePage;
  const meta = ADMIN_PAGE_META[activePage];

  return (
    <SidebarInset
      className={cn(
        "dashboard-shell dashboard-shell--admin min-h-svh relative overflow-hidden",
        a.canvas,
        "bg-background",
        "text-foreground",
        "transition-colors duration-500"
      )}
    >
      <BreadcrumbBar
        className={cn("relative z-10", a.breadcrumbBar)}
        segments={[
          ...(meta.group
            ? [
                {
                  label: meta.group,
                  hideOnMobile: true,
                  onClick: () => setLocation(meta.groupPath!),
                },
              ]
            : []),
          { label: meta.title },
        ]}
        center={
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className={cn(
              a.toolbarButton,
              "flex h-8 items-center gap-2 rounded-xl px-3 text-xs text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="ml-1 hidden font-mono text-[10px] opacity-60 sm:inline">
              ⌘K
            </kbd>
          </button>
        }
        trailing={<ThemeToggle />}
      />

      <div className="flex-1 relative flex flex-col z-10 min-h-0">
        {guardedPage === "dashboard" ? (
          <DashboardPage />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="w-full mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              {guardedPage === "streams" && <StreamsPage />}
              {guardedPage === "users" && isAdmin && <UsersPage />}
              {guardedPage === "features" && isAdmin && <FeatureControlsPage />}
              {guardedPage === "featurePresets" && isAdmin && (
                <FeaturePresetsPage />
              )}
            </div>
          </div>
        )}
      </div>
      <AdminCommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        items={commandItems}
        onSelect={path => setLocation(path)}
      />
    </SidebarInset>
  );
}
