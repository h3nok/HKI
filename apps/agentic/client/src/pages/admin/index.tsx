/**
 * Control Plane — Layout Shell
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
  HkiMark,
} from "@hki/ui";
import {
  LayoutDashboard,
  Layers,
  Users,
  BookOpen,
  MessageSquare,
  ArrowLeft,
  LifeBuoy,
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
import {
  AppSidebarBrand,
  AppSidebarSectionLabel,
} from "@/components/ui/app-shell-primitives";
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
        label: "Domains",
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
  usePageMeta("Control Plane — Hermetic", "/favicon.svg");

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
            You need Platform Admin privileges to access the Control Plane.
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
    <SidebarProvider
      style={
        {
          "--sidebar-width": "18.5rem",
          "--sidebar-width-icon": "4rem",
        } as React.CSSProperties
      }
    >
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

  const settingsMenuItems = SETTINGS_MENU_ITEMS.filter(
    item => !item.adminOnly || isAdmin
  );

  const handleReportBug = () =>
    openBugReport({
      area: "Control Plane",
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

  const visibleGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(i => !i.adminOnly || isAdmin),
  })).filter(g => g.items.length > 0);

  return (
    <Sidebar
      collapsible="icon"
      className={cn(
        "cp-sidebar admin-sidebar-shell",
        "border-r-0 bg-sidebar shadow-none"
      )}
    >
      {/* ── Header: shared product brand primitive ── */}
      <SidebarHeader
        className={cn(isCollapsed ? "px-2 py-3" : "px-4 pt-4 pb-3")}
      >
        <AppSidebarBrand
          collapsed={isCollapsed}
          eyebrow="HKI Ops"
          title="Control Plane"
          ariaLabel="Control Plane Home"
          onClick={() => setLocation("/admin")}
          className="admin-sidebar-product-brand"
          icon={<HkiMark size={24} variant="color" />}
        />
      </SidebarHeader>

      {/* ── Navigation: Chapters ── */}
      <SidebarContent className={cn("pt-1.5", isCollapsed ? "px-1.5" : "px-3")}>
        {visibleGroups.map(group => (
          <SidebarGroup key={group.label} className="shrink-0 py-1.5">
            {!isCollapsed && (
              <div className="px-3.5 pt-2 pb-1.5 first:pt-1.5">
                <AppSidebarSectionLabel>
                  {group.label}
                </AppSidebarSectionLabel>
              </div>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1.5">
                {group.items.map(item => {
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
                          "admin-sidebar-nav-button group/nav relative text-[14px] font-semibold",
                          "rounded-xl transition-colors duration-200",
                          isCollapsed
                            ? "h-11 w-11 justify-center px-0"
                            : "h-11 gap-3 px-3.5"
                        )}
                      >
                        <span className="admin-sidebar-nav-icon flex size-7 shrink-0 items-center justify-center rounded-lg">
                          <item.icon className="size-4 shrink-0" />
                        </span>
                        {!isCollapsed && (
                          <span className="admin-sidebar-nav-text flex-1 truncate text-[14px]">
                            {item.label}
                          </span>
                        )}
                        {!isCollapsed &&
                          item.badgeKey &&
                          badgeCounts[item.badgeKey] != null && (
                            <span className="admin-sidebar-nav-count ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 font-mono text-[11px] font-semibold tabular-nums">
                              {badgeCounts[item.badgeKey]}
                            </span>
                          )}
                        {opensInNewTab && !isCollapsed && (
                          <ExternalLink className="admin-sidebar-nav-shortcut ml-auto size-3" />
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

      {/* ── Footer: Quiet bug link + editorial user line ── */}
      <SidebarFooter className={cn(isCollapsed ? "p-2.5" : "px-3.5 pb-3 pt-2")}>
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleReportBug}
              tooltip="Open support"
              className={cn(
                "admin-sidebar-soft-button text-sm font-medium rounded-xl transition-colors duration-150",
                isCollapsed
                  ? "h-11 w-11 justify-center px-0"
                  : "h-10 gap-3 px-3.5"
              )}
            >
              <LifeBuoy className="size-4 shrink-0" />
              {!isCollapsed && <span className="flex-1 truncate">Support</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu className="mt-1">
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className={cn(
                    "admin-sidebar-user-trigger rounded-xl px-2.5 py-2.5 transition-colors duration-150"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 rounded-lg">
                      <AvatarFallback className="rounded-lg text-[11px] font-bold bg-primary/15 text-primary">
                        {user?.name ? getInitials(user.name) : "U"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="grid flex-1 text-left leading-none">
                    <span className="truncate text-[14px] font-semibold text-foreground">
                      {user?.name || "User"}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
                        {isAdmin ? "Admin" : "Manager"}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="truncate text-[11px] text-muted-foreground/70">
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
                      <AvatarFallback className="rounded-xl text-xs font-bold bg-primary text-primary-foreground">
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

      {/* Version eyebrow */}
      {!isCollapsed && (
        <div className="px-4 pb-2 pt-1">
          <p
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50"
            title={formatAppVersionTitle("Control Plane", APP_BUILD_INFO)}
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
    title: "Domains",
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
              "hidden h-9 items-center gap-2 rounded-xl px-3.5 text-sm text-muted-foreground hover:text-foreground sm:flex"
            )}
          >
            <Search className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Search…</span>
            <kbd className="ml-1 hidden font-mono text-[11px] opacity-60 sm:inline">
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
            <div className="admin-internal-page-frame w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
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
