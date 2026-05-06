"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeftClose, PanelLeft, ChevronLeft } from "lucide-react";
import { cn } from "../utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

// --- Context ---
interface SidebarContextValue {
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  collapsible: "icon" | "full" | "none";
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

// --- SidebarProvider ---
interface SidebarProviderProps {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  collapsible?: "icon" | "full" | "none";
}

function SidebarProvider({
  children,
  defaultCollapsed = false,
  collapsible = "icon",
}: SidebarProviderProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, collapsible }}>
      <TooltipProvider delayDuration={0}>
        <div className="flex min-h-screen">{children}</div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

// --- Sidebar (Atelier) — single hairline right border, no shadow ---
const sidebarVariants = cva(
  "flex flex-col border-r border-border/70 bg-sidebar transition-[width] duration-150 ease-out",
  {
    variants: {
      variant: {
        default: "bg-sidebar",
        inset: "bg-sidebar",
        floating: "bg-sidebar m-2 rounded-md border border-border/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface SidebarProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sidebarVariants> {
  width?: string;
  collapsedWidth?: string;
}

function Sidebar({
  className,
  variant,
  width = "14rem",
  collapsedWidth = "3.5rem",
  children,
  ...props
}: SidebarProps) {
  const { collapsed, collapsible } = useSidebar();

  const currentWidth =
    collapsible === "none" ? width : collapsed ? collapsedWidth : width;

  return (
    <aside
      className={cn("relative", sidebarVariants({ variant }), className)}
      style={{ width: currentWidth, minWidth: currentWidth }}
      {...props}
    >
      {children}
    </aside>
  );
}

// --- SidebarHeader ---
function SidebarHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center h-16 px-4 border-b border-border",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// --- SidebarContent ---
function SidebarContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex-1 overflow-y-auto py-4", className)} {...props}>
      {children}
    </div>
  );
}

// --- SidebarFooter ---
function SidebarFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("border-t border-border p-4", className)} {...props}>
      {children}
    </div>
  );
}

// --- SidebarGroup ---
function SidebarGroup({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-3 py-2", className)} {...props}>
      {children}
    </div>
  );
}

// --- SidebarGroupLabel ---
function SidebarGroupLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { collapsed } = useSidebar();

  if (collapsed) return null;

  return (
    <div
      className={cn(
        "px-3 mb-1.5 text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// --- SidebarGroupContent ---
function SidebarGroupContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {children}
    </div>
  );
}

// --- SidebarMenu ---
function SidebarMenu({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul className={cn("space-y-1", className)} {...props}>
      {children}
    </ul>
  );
}

// --- SidebarMenuItem ---
function SidebarMenuItem({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn("", className)} {...props}>
      {children}
    </li>
  );
}

// --- SidebarMenuButton (Atelier) — hairline left accent on active, no filled pill ---
const sidebarMenuButtonVariants = cva(
  "relative flex items-center w-full rounded-r text-sm font-medium transition-colors duration-150 ease-out",
  {
    variants: {
      variant: {
        default:
          "text-muted-foreground hover:text-foreground hover:bg-muted/30",
        active:
          "text-foreground bg-muted/50 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-px before:bg-primary",
      },
      size: {
        default: "pl-3 pr-2 h-8 gap-2.5",
        sm: "pl-2.5 pr-2 h-7 gap-2 text-xs",
        lg: "pl-3.5 pr-2.5 h-9 gap-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface SidebarMenuButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  tooltip?: string;
  icon?: React.ReactNode;
}

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  SidebarMenuButtonProps
>(
  (
    { className, variant, size, tooltip, icon, children, asChild, ...props },
    ref,
  ) => {
    const { collapsed } = useSidebar();

    const button = (
      <button
        ref={ref}
        className={cn(
          sidebarMenuButtonVariants({ variant, size }),
          collapsed && "justify-center px-0",
          className,
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {!collapsed && children}
      </button>
    );

    if (collapsed && tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {tooltip}
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  },
);
SidebarMenuButton.displayName = "SidebarMenuButton";

// --- SidebarMenuSub ---
interface SidebarMenuSubProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
}

function SidebarMenuSub({
  className,
  open,
  children,
  ...props
}: SidebarMenuSubProps) {
  const { collapsed } = useSidebar();

  if (collapsed) return null;

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200",
        open ? "max-h-96" : "max-h-0",
        className,
      )}
      {...props}
    >
      <ul className="pl-6 mt-1 space-y-1 border-l border-neutral-200 dark:border-neutral-700 ml-4">
        {children}
      </ul>
    </div>
  );
}

// --- SidebarMenuSubItem ---
function SidebarMenuSubItem({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return (
    <li className={cn("", className)} {...props}>
      {children}
    </li>
  );
}

// --- SidebarMenuSubButton ---
const SidebarMenuSubButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }
>(({ className, active, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        "flex items-center w-full pl-3 pr-2 h-7 text-sm rounded-r transition-colors duration-150 ease-out",
        active
          ? "text-foreground bg-muted/40"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
SidebarMenuSubButton.displayName = "SidebarMenuSubButton";

// --- SidebarTrigger ---
interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showLabel?: boolean;
}

const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  ({ className, showLabel, ...props }, ref) => {
    const { collapsed, setCollapsed, collapsible } = useSidebar();

    if (collapsible === "none") return null;

    return (
      <button
        ref={ref}
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "inline-flex items-center justify-center w-8 h-8 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors duration-150 ease-out",
          className,
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        {...props}
      >
        {collapsed ? (
          <PanelLeft className="h-5 w-5" />
        ) : (
          <PanelLeftClose className="h-5 w-5" />
        )}
        {showLabel && !collapsed && <span className="text-sm">Collapse</span>}
      </button>
    );
  },
);
SidebarTrigger.displayName = "SidebarTrigger";

// --- SidebarInset ---
function SidebarInset({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <main
      className={cn("flex-1 overflow-auto bg-background", className)}
      {...props}
    >
      {children}
    </main>
  );
}

// --- SidebarRail ---
function SidebarRail({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { collapsed, setCollapsed, collapsible } = useSidebar();

  if (collapsible === "none") return null;

  return (
    <button
      onClick={() => setCollapsed(!collapsed)}
      className={cn(
        "absolute top-0 right-0 z-20 h-full w-3 translate-x-1/2 cursor-col-resize",
        "group/rail",
        className,
      )}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      {...props}
    >
      {/* Visible rail line on hover */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-all duration-200",
          "bg-transparent group-hover/rail:bg-primary/30",
        )}
      />
      {/* Chevron indicator */}
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-5 h-8 rounded-md flex items-center justify-center",
          "opacity-0 group-hover/rail:opacity-100 transition-all duration-200",
          "bg-card border border-border shadow-sm",
        )}
      >
        <ChevronLeft
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
            collapsed && "rotate-180",
          )}
        />
      </div>
    </button>
  );
}

// --- SidebarSeparator ---
function SidebarSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("h-px mx-3 my-2 bg-border/70", className)} {...props} />
  );
}

export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  SidebarInset,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
};
