/**
 * ProductSwitcher — Cross-product navigation for the HKI Innovation Platform.
 *
 * Renders a dropdown in the sidebar that lets users switch between
 * Agentic AI and Mobile Web. Each product lives at its own
 * origin/subdomain but shares the same SSO session.
 *
 * Usage:
 *   <ProductSwitcher
 *     currentProduct="agentic"
 *     products={[
 *       { id: "agentic", label: "Agentic AI", href: "https://agentic.hki-innovation.dev", icon: <BotIcon /> },
 *       { id: "mobile", label: "Mobile", href: "https://mobile.hki-innovation.dev", icon: <MobileIcon /> },
 *     ]}
 *   />
 */

import * as React from "react";
import { cn } from "../utils";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface Product {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface ProductSwitcherProps {
  currentProduct: string;
  products: Product[];
  collapsed?: boolean;
  className?: string;
  onNavigate?: (product: Product) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Default product definitions
// ═══════════════════════════════════════════════════════════════════════════════

export const PLATFORM_PRODUCTS: Product[] = [
  {
    id: "agentic",
    label: "Agentic AI",
    description: "Conversational AI with retrieval-augmented generation",
    href: "/",
    badge: "AI",
  },
  {
    id: "mobile",
    label: "Mobile",
    description: "Field operations & on-the-go access",
    href: "/",
    badge: "Beta",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// Built-in product icons (inline SVG to avoid lucide dependency)
// ═══════════════════════════════════════════════════════════════════════════════

function AgenticIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a4 4 0 0 1 4 4v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V6a4 4 0 0 1 4-4z" />
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <path d="M7 8v2a5 5 0 0 0 10 0V8" />
      <path d="M12 15v4" />
      <path d="M8 21h8" />
      <path d="M5 11l-2 1" />
      <path d="M19 11l2 1" />
    </svg>
  );
}

function MobileIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12" y2="18" />
    </svg>
  );
}

const DEFAULT_ICONS: Record<string, React.ReactNode> = {
  agentic: <AgenticIcon className="w-4 h-4" />,
  mobile: <MobileIcon className="w-4 h-4" />,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export function ProductSwitcher({
  currentProduct,
  products,
  collapsed = false,
  className,
  onNavigate,
}: ProductSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const current = products.find(p => p.id === currentProduct) ?? products[0];

  // Close on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
    return undefined;
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
    return undefined;
  }, [open]);

  const handleSelect = (product: Product) => {
    setOpen(false);
    if (product.id === currentProduct) return;
    if (onNavigate) {
      onNavigate(product);
    } else {
      window.location.href = product.href;
    }
  };

  const icon = current?.icon ?? DEFAULT_ICONS[current?.id ?? ""];

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-2 w-full rounded-lg px-2 py-2",
          "text-sm font-medium transition-colors duration-150",
          "hover:bg-sidebar-accent text-sidebar-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center"
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Switch product — current: ${current?.label}`}
      >
        <span
          className={cn(
            "flex items-center justify-center w-7 h-7 rounded-md",
            "bg-primary text-primary-foreground shrink-0"
          )}
        >
          {icon}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left truncate">{current?.label}</span>
            <svg
              className={cn(
                "w-4 h-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 w-64 rounded-lg border bg-popover p-1 shadow-lg",
            "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
            collapsed ? "left-full ml-2 top-0" : "left-0 top-full"
          )}
          role="listbox"
          aria-label="Products"
        >
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            HKI Innovation Platform
          </div>
          {products.map(product => {
            const isActive = product.id === currentProduct;
            const productIcon =
              product.icon ?? DEFAULT_ICONS[product.id] ?? null;
            return (
              <button
                key={product.id}
                onClick={() => handleSelect(product)}
                className={cn(
                  "flex items-center gap-3 w-full rounded-md px-2 py-2.5 text-sm",
                  "transition-colors duration-100",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-popover-foreground hover:bg-accent/50"
                )}
                role="option"
                aria-selected={isActive}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-md shrink-0",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {productIcon}
                </span>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{product.label}</span>
                    {product.badge && (
                      <span
                        className={cn(
                          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold leading-none",
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {product.badge}
                      </span>
                    )}
                  </div>
                  {product.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {product.description}
                    </div>
                  )}
                </div>
                {isActive && (
                  <svg
                    className="w-4 h-4 shrink-0 text-primary"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
