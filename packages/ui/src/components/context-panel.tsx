'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { X, PanelRightClose, PanelRight } from 'lucide-react';
import { cn } from '../utils';

/* ═══════════════════════════════════════════════════════════════════════════
   CONTEXT PANEL COMPONENT
   
   Width: 320px (fixed)
   Position: Right side of content area
   Purpose: Filters, Actions, Metadata, Details
   
   Responsive behavior:
   - Desktop (≥1280px): Visible inline
   - Laptop (≥1024px): Collapses to overlay
   - Tablet/Mobile: Hidden, accessible via trigger
   
   Based on Layout Patterns & Grid System spec
   ═══════════════════════════════════════════════════════════════════════════ */

// --- Context ---
interface ContextPanelContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mode: 'inline' | 'overlay';
}

const ContextPanelContext = React.createContext<ContextPanelContextValue | null>(null);

export function useContextPanel() {
  const context = React.useContext(ContextPanelContext);
  if (!context) {
    throw new Error('useContextPanel must be used within a ContextPanelProvider');
  }
  return context;
}

// --- Provider ---
interface ContextPanelProviderProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** 'inline' shows panel alongside content, 'overlay' shows as overlay */
  defaultMode?: 'inline' | 'overlay';
}

export function ContextPanelProvider({
  children,
  defaultOpen = true,
  defaultMode = 'inline',
}: ContextPanelProviderProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [mode, setMode] = React.useState<'inline' | 'overlay'>(defaultMode);

  // Handle responsive mode changes
  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setMode('inline');
      } else {
        setMode('overlay');
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <ContextPanelContext.Provider value={{ open, setOpen, mode }}>
      {children}
    </ContextPanelContext.Provider>
  );
}

// --- Panel Variants ---
const contextPanelVariants = cva(
  'flex flex-col bg-background border-l border-border transition-all duration-300',
  {
    variants: {
      mode: {
        inline: 'relative h-full',
        overlay: 'fixed inset-y-0 right-0 z-overlay shadow-xl',
      },
    },
    defaultVariants: {
      mode: 'inline',
    },
  }
);

// --- Context Panel ---
interface ContextPanelProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof contextPanelVariants> {
  width?: string;
}

export function ContextPanel({
  className,
  width = '320px',
  children,
  ...props
}: ContextPanelProps) {
  const { open, setOpen, mode } = useContextPanel();

  if (!open) return null;

  return (
    <>
      {/* Backdrop for overlay mode */}
      {mode === 'overlay' && (
        <div
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-overlay animate-fade-in"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          contextPanelVariants({ mode }),
          mode === 'overlay' && 'animate-slide-left',
          className
        )}
        style={{ width, minWidth: width }}
        {...props}
      >
        {children}
      </aside>
    </>
  );
}

// --- Context Panel Header ---
interface ContextPanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  showClose?: boolean;
}

export function ContextPanelHeader({
  className,
  title,
  showClose = true,
  children,
  ...props
}: ContextPanelHeaderProps) {
  const { setOpen } = useContextPanel();

  return (
    <div
      className={cn(
        'flex items-center justify-between h-14 px-4 border-b border-border flex-shrink-0',
        className
      )}
      {...props}
    >
      {title ? (
        <h3 className="font-semibold text-foreground">
          {title}
        </h3>
      ) : (
        children
      )}
      {showClose && (
        <button
          onClick={() => setOpen(false)}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-accent transition-colors"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// --- Context Panel Content ---
export function ContextPanelContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex-1 overflow-y-auto p-4', className)}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Context Panel Footer ---
export function ContextPanelFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex-shrink-0 p-4 border-t border-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// --- Context Panel Section ---
interface ContextPanelSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function ContextPanelSection({
  className,
  title,
  collapsible = false,
  defaultOpen = true,
  children,
  ...props
}: ContextPanelSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className={cn('mb-6 last:mb-0', className)} {...props}>
      {title && (
        <button
          onClick={() => collapsible && setIsOpen(!isOpen)}
          className={cn(
            'flex items-center justify-between w-full mb-3',
            collapsible && 'cursor-pointer'
          )}
          disabled={!collapsible}
        >
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h4>
          {collapsible && (
            <span
              className={cn(
                'text-neutral-400 transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            >
              ▼
            </span>
          )}
        </button>
      )}
      {(!collapsible || isOpen) && <div>{children}</div>}
    </div>
  );
}

// --- Context Panel Trigger ---
interface ContextPanelTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showLabel?: boolean;
}

export const ContextPanelTrigger = React.forwardRef<HTMLButtonElement, ContextPanelTriggerProps>(
  ({ className, showLabel, ...props }, ref) => {
    const { open, setOpen } = useContextPanel();

    return (
      <button
        ref={ref}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-accent transition-colors',
          className
        )}
        aria-label={open ? 'Close context panel' : 'Open context panel'}
        {...props}
      >
        {open ? (
          <PanelRightClose className="h-5 w-5" />
        ) : (
          <PanelRight className="h-5 w-5" />
        )}
        {showLabel && (
          <span className="text-sm">{open ? 'Hide' : 'Show'} Panel</span>
        )}
      </button>
    );
  }
);
ContextPanelTrigger.displayName = 'ContextPanelTrigger';

export { contextPanelVariants };
