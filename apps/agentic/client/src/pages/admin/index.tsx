/**
 * Control Plane — Layout Shell
 *
 * Sidebar layout with grouped sections,
 * SidebarProvider + SidebarInset pattern, and PageShell content area.
 *
 * Routes: /admin, /admin/streams, /admin/users, /admin/settings,
 *         /admin/settings/presets
 * Auth: admin-only
 */

import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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
  ShieldCheck,
  SlidersHorizontal,
  ShieldAlert,
  Fingerprint,
  Lock,
  Info,
  Server,
  Cpu,
  Activity,
  Bot,
  Network,
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
import { trpc, type RouterOutputs } from "@/lib/trpc";

type AdminValueStream = RouterOutputs["admin"]["listValueStreams"][number];
import { toast } from "sonner";

import { Search } from "lucide-react";
import DashboardPage from "./DashboardPage";
import StreamsPage from "./StreamsPage";
import UsersPage from "./UsersPage";
import AuditPage from "./AuditPage";
import GeapPage from "./GeapPage";
import FeatureControlsPage from "./FeatureControlsPage";
import FeaturePresetsPage from "./FeaturePresetsPage";
import EngineeringPage from "./EngineeringPage";
import { a } from "./theme";
import {
  AdminCommandPalette,
  type CommandItem,
} from "./components/AdminCommandPalette";

// ── Brand ────────────────────────────────────────────────────────────────────

// ── Navigation structure (grouped sections) ───────────────────────────────────

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
    label: "Engineering",
    items: [
      {
        icon: Network,
        label: "Myelin",
        path: "/admin/engineering",
        shortcut: "⌘M",
      },
    ],
  },
  {
    label: "Agent Platform",
    items: [
      {
        icon: Bot,
        label: "GEAP Head",
        path: "/admin/geap",
        shortcut: "⌘9",
        adminOnly: true,
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
      {
        icon: ShieldCheck,
        label: "Audit Evidence",
        path: "/admin/audit",
        shortcut: "⌘6",
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
  | "geap"
  | "streams"
  | "users"
  | "audit"
  | "features"
  | "featurePresets"
  | "engineering";

function resolvePageFromPath(pathname: string): AdminPage {
  if (pathname === SETTINGS_PRESETS_PATH) return "featurePresets";
  if (pathname === "/admin/geap") return "geap";
  if (pathname === "/admin/audit") return "audit";
  if (pathname === "/admin/streams") return "streams";
  if (pathname === "/admin/users") return "users";
  if (pathname === "/admin/engineering") return "engineering";
  if (pathname === "/admin/features" || pathname === SETTINGS_PATH)
    return "features";
  return "dashboard";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN LAYOUT (entry point)
// ═══════════════════════════════════════════════════════════════════════════════

const EASE = [0.22, 1, 0.36, 1] as const;

export default function AdminLayout() {
  const { role } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  usePageMeta("Control Plane — Hermetic", "/favicon.svg");

  const isAdmin = role === "admin";

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-background flex items-center justify-center">
        {/* ── Ambient canvas ── */}
        <div className="absolute inset-0" />

        {/* Mesh glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[120px]"
            style={{
              background:
                "radial-gradient(circle, rgba(239,68,68,0.1) 0%, transparent 70%)",
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.6, 0.8, 0.6],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[120px]"
            style={{
              background:
                "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
            }}
            animate={{
              scale: [1.1, 1, 1.1],
              opacity: [0.5, 0.7, 0.5],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        {/* Grain overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025] dark:opacity-[0.035]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: "200px 200px",
          }}
        />

        {/* Card and Content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="relative z-10 w-full max-w-lg px-6"
        >
          <div
            className="rounded-2xl p-8 border backdrop-blur-2xl relative overflow-hidden"
            style={{
              borderColor:
                "color-mix(in srgb, var(--neutral-0) 12%, var(--border))",
              background:
                "color-mix(in srgb, var(--neutral-0) 6%, rgba(0,0,0,0.03))",
              boxShadow: "var(--shadow-2xl)",
            }}
          >
            {/* Animated alert lights in header of card */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

            <div className="flex flex-col items-center text-center">
              {/* Shield Emblem with pulse */}
              <div className="relative mb-6">
                <motion.div
                  className="absolute inset-0 rounded-full blur-xl"
                  style={{
                    background: "rgba(239, 68, 68, 0.15)",
                  }}
                  animate={{
                    scale: [1, 1.4, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-500">
                  <ShieldAlert className="w-8 h-8" />
                </div>
              </div>

              {/* Title & subtitle */}
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-2">
                Control Plane Gateway Shield
              </h1>
              <p className="text-muted-foreground text-sm max-w-md mb-6">
                You have reached a restricted internal boundary of the Hermetic
                Knowledge Isolation (HKI) control plane. Explicit admin-plane
                authorizations are required.
              </p>

              {/* Isolation Diagnostics Panel */}
              <div
                className="w-full rounded-xl border p-4 mb-6 text-left font-mono text-xs space-y-2.5 bg-neutral-950/5 dark:bg-neutral-950/20"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--neutral-0) 10%, var(--border))",
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-sans font-semibold text-[11px] uppercase tracking-wider">
                    <Fingerprint className="w-3.5 h-3.5 text-primary" />
                    Identity & Security Diagnostics
                  </span>
                  <span className="text-red-500/90 bg-red-500/10 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/20">
                    ACCESS_DENIED
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Subject Role:</span>
                  <span className="text-foreground font-semibold bg-foreground/5 px-2 py-0.5 rounded">
                    {role || "guest"}
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">Required Role:</span>
                  <span className="text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded">
                    admin
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">
                    Invariants Check:
                  </span>
                  <span className="text-green-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Fail-Closed (Active)
                  </span>
                </div>

                <div className="flex justify-between items-center py-0.5">
                  <span className="text-muted-foreground">
                    Request Signature:
                  </span>
                  <span
                    className="text-muted-foreground/80 truncate max-w-[200px]"
                    title="sha256:d8a2bc4...ec19"
                  >
                    sha256:d8a2bc4...ec19
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                <a
                  href="/chat"
                  className="flex-1 w-full h-11 rounded-xl font-semibold text-sm text-primary-foreground
                             flex items-center justify-center gap-2 overflow-hidden bg-primary shadow-md
                             transition-all duration-200 hover:-translate-y-0.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Chat Workspace</span>
                </a>

                <a
                  href="/login"
                  className="flex-1 w-full h-11 rounded-xl font-semibold text-sm text-foreground
                             flex items-center justify-center gap-2 border border-border/50 hover:bg-muted/50
                             transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  <span>Re-authenticate</span>
                </a>
              </div>

              <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-muted-foreground/60">
                <Info className="w-3.5 h-3.5" />
                <span>
                  Violation recorded under Invariant 6 (Audit Plane Separation).
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
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
// SIDEBAR (glassmorphic)
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
    streams: (streamsQ.data ?? []).filter(
      (s: AdminValueStream) => s.id !== "global"
    ).length,
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
                <AppSidebarSectionLabel>{group.label}</AppSidebarSectionLabel>
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
        {/* On-Prem System Telemetry Widget (Collapsed shortcut only) */}
        {isCollapsed && (
          <div className="mb-2">
            <div className="flex justify-center p-2 rounded-xl bg-primary/5 border border-primary/10 relative group/telemetry">
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Server className="size-4 text-primary" />
              {/* Tooltip on hover */}
              <div className="absolute left-12 top-0 scale-0 group-hover/telemetry:scale-100 transition-all origin-left duration-200 z-50 bg-neutral-900 border border-border rounded-xl p-3.5 shadow-xl w-60 font-sans text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-foreground">
                    On-Prem Node Active
                  </span>
                </div>
                <div className="space-y-1 font-mono text-[10px] text-muted-foreground">
                  <p>Node: hki-node-prd-01</p>
                  <p>Mode: Isolated Airgap</p>
                  <p>CPU: 12.4% · RAM: 4.8 GB</p>
                  <p>SSO HSM: Verified</p>
                </div>
              </div>
            </div>
          </div>
        )}

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
                      <span className="text-muted-foreground/60">·</span>
                      <span className="truncate text-[11px] text-muted-foreground/85">
                        {user?.email || ""}
                      </span>
                    </div>
                  </div>
                  <ChevronsUpDown className="ml-auto size-3.5 text-muted-foreground/60" />
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
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70"
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
  geap: {
    title: "GEAP Head",
    group: "Agent Platform",
    groupPath: "/admin",
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
  audit: {
    title: "Audit Evidence",
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
  engineering: {
    title: "Myelin",
    group: "Engineering",
    groupPath: "/admin",
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
        trailing={
          <div className="flex items-center gap-3">
            {/* Enterprise Airgap pill indicator */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 relative group/top-pill cursor-help">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="size-3" />
                Airgap Local HSM
              </span>

              {/* Top pill detailed popup tooltip on hover */}
              <div className="absolute right-0 top-10 scale-0 group-hover/top-pill:scale-100 transition-all origin-top-right duration-200 z-50 bg-neutral-900/95 backdrop-blur-md border border-border rounded-xl p-4 shadow-2xl w-72 text-left text-xs font-sans">
                <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-2.5">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    On-Prem Cluster Node
                  </span>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                    v1.2.4
                  </span>
                </div>
                <div className="space-y-1.5 font-mono text-[10.5px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Cluster Host:</span>
                    <span className="text-foreground font-semibold">
                      onprem-hki-01
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>IP Address:</span>
                    <span className="text-foreground font-semibold">
                      10.124.8.45
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Airgap Security:</span>
                    <span className="text-emerald-500 font-semibold">
                      Strict Isolated
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>SSO Authenticator:</span>
                    <span className="text-foreground">SAML HSM Active</span>
                  </div>
                </div>
              </div>
            </div>

            <ThemeToggle />
          </div>
        }
      />

      <div className="flex-1 relative flex flex-col z-10 min-h-0">
        {guardedPage === "dashboard" ? (
          <DashboardPage />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="admin-internal-page-frame w-full mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
              {guardedPage === "streams" && <StreamsPage />}
              {guardedPage === "geap" && isAdmin && <GeapPage />}
              {guardedPage === "users" && isAdmin && <UsersPage />}
              {guardedPage === "audit" && isAdmin && <AuditPage />}
              {guardedPage === "features" && isAdmin && <FeatureControlsPage />}
              {guardedPage === "featurePresets" && isAdmin && (
                <FeaturePresetsPage />
              )}
              {guardedPage === "engineering" && <EngineeringPage />}
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
