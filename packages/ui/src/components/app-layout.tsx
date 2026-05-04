'use client';

import * as React from 'react';
import { cn } from '../utils';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from './sidebar';
import { Topbar, TopbarSearch, TopbarAction } from './topbar';
import {
  ContextPanelProvider,
  ContextPanel,
  ContextPanelHeader,
  ContextPanelContent,
  ContextPanelTrigger,
  useContextPanel,
} from './context-panel';

/* ═══════════════════════════════════════════════════════════════════════════
   APP LAYOUT SYSTEM
   
   Based on Layout Patterns & Grid System spec:
   
   1. App Shell Structure:
      - TopBar: 60px height (Navigation, Search, User Menu)
      - Sidebar: 240px open / 60px collapsed (Main Navigation)
      - Content Area: Router Outlet
      - Context Panel: 320px (Filters, Actions, Metadata)
   
   2. Grid System:
      - 12-Column Grid
      - Max content width: 1440px
      - Gutter width: 24px
      - Margin: 32px on each side
   
   3. Responsive Breakpoints:
      - Desktop (≥1280px): Full layout with all panels
      - Laptop (≥1024px): Context panel collapses to overlay
      - Tablet (≥768px): Sidebar collapses to icon-only mode
      - Mobile (<768px): Sidebar hidden, accessible via drawer menu
   ═══════════════════════════════════════════════════════════════════════════ */

// --- Layout Constants ---
export const LAYOUT_CONSTANTS = {
  TOPBAR_HEIGHT: 60,
  SIDEBAR_WIDTH: 240,
  SIDEBAR_COLLAPSED_WIDTH: 60,
  CONTEXT_PANEL_WIDTH: 320,
  CONTENT_MAX_WIDTH: 1440,
  GRID_COLUMNS: 12,
  GUTTER_WIDTH: 24,
  MARGIN: 32,
} as const;

// --- Main Layout Context ---
interface AppLayoutContextValue {
  showContextPanel: boolean;
  setShowContextPanel: React.Dispatch<React.SetStateAction<boolean>>;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const AppLayoutContext = React.createContext<AppLayoutContextValue | null>(null);

export function useAppLayout() {
  const context = React.useContext(AppLayoutContext);
  if (!context) {
    throw new Error('useAppLayout must be used within an AppLayoutProvider');
  }
  return context;
}

// --- App Layout Provider ---
interface AppLayoutProviderProps {
  children: React.ReactNode;
  defaultSidebarCollapsed?: boolean;
  defaultContextPanelOpen?: boolean;
}

export function AppLayoutProvider({
  children,
  defaultSidebarCollapsed = false,
  defaultContextPanelOpen = true,
}: AppLayoutProviderProps) {
  const [showContextPanel, setShowContextPanel] = React.useState(defaultContextPanelOpen);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <AppLayoutContext.Provider
      value={{ showContextPanel, setShowContextPanel, mobileMenuOpen, setMobileMenuOpen }}
    >
      <SidebarProvider defaultCollapsed={defaultSidebarCollapsed}>
        <ContextPanelProvider defaultOpen={defaultContextPanelOpen}>
          {children}
        </ContextPanelProvider>
      </SidebarProvider>
    </AppLayoutContext.Provider>
  );
}

// --- App Layout Shell ---
interface AppLayoutShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayoutShell({ children, className }: AppLayoutShellProps) {
  return (
    <div className={cn('flex min-h-screen bg-background', className)}>
      {children}
    </div>
  );
}

// --- App Layout Sidebar ---
interface AppLayoutSidebarProps {
  brandIcon?: React.ReactNode;
  brandName?: string;
  navigation?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AppLayoutSidebar({
  brandIcon,
  brandName,
  navigation,
  footer,
  className,
}: AppLayoutSidebarProps) {
  const { collapsed } = useSidebar();

  return (
    <Sidebar
      width={`${LAYOUT_CONSTANTS.SIDEBAR_WIDTH}px`}
      collapsedWidth={`${LAYOUT_CONSTANTS.SIDEBAR_COLLAPSED_WIDTH}px`}
      className={cn('hidden lg:flex', className)}
    >
      <SidebarHeader>
        <div className="flex items-center gap-3">
          {brandIcon && (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-hki-blue-500 to-hki-blue-700 flex items-center justify-center text-white flex-shrink-0">
              {brandIcon}
            </div>
          )}
          {!collapsed && brandName && (
            <span className="font-bold text-lg text-foreground truncate">
              {brandName}
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>{navigation}</SidebarContent>

      {footer && <SidebarFooter>{footer}</SidebarFooter>}
    </Sidebar>
  );
}

// --- App Layout Main ---
interface AppLayoutMainProps {
  children: React.ReactNode;
  topbar?: React.ReactNode;
  contextPanel?: React.ReactNode;
  className?: string;
}

export function AppLayoutMain({
  children,
  topbar,
  contextPanel,
  className,
}: AppLayoutMainProps) {
  return (
    <SidebarInset className={cn('flex flex-col flex-1 min-w-0', className)}>
      {topbar}
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
        {contextPanel}
      </div>
    </SidebarInset>
  );
}

// --- Content Container (12-column grid) ---
interface ContentContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether to apply max-width constraint */
  constrained?: boolean;
  /** Padding size */
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function ContentContainer({
  className,
  constrained = true,
  padding = 'lg',
  children,
  ...props
}: ContentContainerProps) {
  const paddingClasses = {
    none: '',
    sm: 'px-4 py-4',
    md: 'px-6 py-6',
    lg: 'px-8 py-8',
  };

  return (
    <div
      className={cn(
        'w-full',
        constrained && 'mx-auto',
        paddingClasses[padding],
        className
      )}
      style={constrained ? { maxWidth: `${LAYOUT_CONSTANTS.CONTENT_MAX_WIDTH}px` } : undefined}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Grid Container ---
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns (1-12) */
  cols?: 1 | 2 | 3 | 4 | 6 | 12;
  /** Gap size */
  gap?: 'sm' | 'md' | 'lg';
}

export function Grid({ className, cols = 12, gap = 'md', children, ...props }: GridProps) {
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    12: 'grid-cols-4 md:grid-cols-6 lg:grid-cols-12',
  };

  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
  };

  return (
    <div
      className={cn('grid', colClasses[cols], gapClasses[gap], className)}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Grid Item ---
interface GridItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Column span (1-12) */
  span?: number;
  /** Column span on medium screens */
  spanMd?: number;
  /** Column span on large screens */
  spanLg?: number;
}

export function GridItem({
  className,
  span = 1,
  spanMd,
  spanLg,
  children,
  ...props
}: GridItemProps) {
  const spanClass = `col-span-${span}`;
  const spanMdClass = spanMd ? `md:col-span-${spanMd}` : '';
  const spanLgClass = spanLg ? `lg:col-span-${spanLg}` : '';

  return (
    <div className={cn(spanClass, spanMdClass, spanLgClass, className)} {...props}>
      {children}
    </div>
  );
}

// --- Page Header ---
interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
}

export function PageHeader({
  className,
  title,
  description,
  actions,
  breadcrumbs,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 pb-6 border-b border-border mb-6',
        className
      )}
      {...props}
    >
      {breadcrumbs && <div className="text-sm">{breadcrumbs}</div>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

// --- Section ---
interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
}

export function Section({
  className,
  title,
  description,
  actions,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn('mb-8 last:mb-0', className)} {...props}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

// Re-export related components
export {
  Topbar,
  TopbarSearch,
  TopbarAction,
  SidebarTrigger,
  ContextPanel,
  ContextPanelHeader,
  ContextPanelContent,
  ContextPanelTrigger,
  useSidebar,
  useContextPanel,
};
