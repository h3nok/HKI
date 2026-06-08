import { type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  PlayCircle,
  Palette,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@hki/ui";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { m } from "../theme.js";

// ─── Myelin logo mark ─────────────────────────────────────────────────────────

function MyelinMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      <line
        x1="3"
        y1="14"
        x2="25"
        y2="14"
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="1.2"
      />
      <ellipse
        cx="9.5"
        cy="14"
        rx="5"
        ry="3.5"
        stroke="var(--primary)"
        strokeWidth="1.6"
      />
      <ellipse
        cx="18.5"
        cy="14"
        rx="5"
        ry="3.5"
        stroke="var(--primary)"
        strokeWidth="1.6"
      />
      <circle cx="14" cy="14" r="2" fill="var(--primary)" />
      <circle cx="14" cy="14" r="1" fill="white" />
    </svg>
  );
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/demo", label: "Demo", icon: PlayCircle },
  { href: "/themes", label: "Themes", icon: Palette },
] as const;

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function ShowcaseSidebar() {
  const [location, setLocation] = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            setLocation("/");
          }}
          className={cn(
            "relative flex min-h-14 w-full items-center overflow-hidden rounded-xl border border-border/70 bg-card",
            "px-3 py-2.5 text-left no-underline transition-colors duration-150",
            "hover:border-primary/30 hover:bg-primary/8",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
            collapsed ? "min-h-12 justify-center px-1.5" : "gap-3"
          )}
          aria-label="Myelin — go to overview"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/8">
            <MyelinMark size={22} />
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <span className="block truncate font-mono text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-muted-foreground">
                Visualizer
              </span>
              <span className="block truncate text-[17px] font-bold leading-[1.05] tracking-normal text-foreground">
                Myelin
              </span>
            </span>
          )}
        </a>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(item => {
                const isActive =
                  item.href === "/"
                    ? location === "/"
                    : location.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                    >
                      <a
                        href={item.href}
                        onClick={e => {
                          e.preventDefault();
                          setLocation(item.href);
                        }}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}

// ─── Topbar breadcrumb ────────────────────────────────────────────────────────

const PAGE_META: Record<
  string,
  { label: string; icon: typeof LayoutDashboard }
> = {
  "/": { label: "Overview", icon: LayoutDashboard },
  "/demo": { label: "Demo", icon: PlayCircle },
  "/themes": { label: "Themes", icon: Palette },
};

function Topbar({ trailing }: { trailing?: ReactNode }) {
  const [location] = useLocation();
  const page = PAGE_META[location] ?? PAGE_META["/"]!;
  const Icon = page.icon;
  const { state, toggleSidebar } = useSidebar();
  const ToggleIcon = state === "collapsed" ? PanelLeftOpen : PanelLeftClose;

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/50 bg-background/80 px-4 backdrop-blur-sm sm:px-6">
      <button
        type="button"
        aria-label="Toggle sidebar"
        onClick={toggleSidebar}
        className={cn(
          "-ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border/55 bg-card/70 text-muted-foreground shadow-sm transition-colors",
          "hover:border-primary/25 hover:bg-primary/10 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        )}
      >
        <ToggleIcon className="h-4 w-4" strokeWidth={2.2} />
        <span className="sr-only">Toggle sidebar</span>
      </button>

      <nav className="flex min-w-0 flex-1 items-center gap-1 text-[15px]">
        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
          <MyelinMark size={16} />
          <span className="hidden sm:inline font-medium">Myelin</span>
        </span>
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        <span className="flex shrink-0 items-center gap-1.5 font-semibold text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {page.label}
        </span>
      </nav>

      {trailing && (
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      )}
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function AppLayout({
  children,
  topbarTrailing,
}: {
  children: ReactNode;
  topbarTrailing?: ReactNode;
}) {
  return (
    <SidebarProvider>
      <ShowcaseSidebar />
      <SidebarInset
        className={cn(
          "dashboard-shell dashboard-shell--admin admin-control-plane-canvas min-h-svh overflow-y-auto text-foreground",
          m.ground
        )}
      >
        <Topbar trailing={topbarTrailing} />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
