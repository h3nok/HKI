/**
 * Empty State Component
 *
 * Displays when there's no data to show with helpful messaging and actions.
 */

import * as React from "react";
import { cn } from "../utils";
import { Inbox, Search, FileQuestion, AlertCircle } from "lucide-react";

export type EmptyStateVariant = "default" | "search" | "error" | "filtered";

const VARIANT_CONFIG: Record<
  EmptyStateVariant,
  { icon: React.ElementType; defaultTitle: string; defaultDescription: string }
> = {
  default: {
    icon: Inbox,
    defaultTitle: "No items yet",
    defaultDescription: "Get started by creating your first item.",
  },
  search: {
    icon: Search,
    defaultTitle: "No results found",
    defaultDescription: "Try adjusting your search or filter criteria.",
  },
  error: {
    icon: AlertCircle,
    defaultTitle: "Something went wrong",
    defaultDescription: "We encountered an error loading this content.",
  },
  filtered: {
    icon: FileQuestion,
    defaultTitle: "No matching items",
    defaultDescription: "No items match your current filters.",
  },
};

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: EmptyStateVariant;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    { className, variant = "default", icon, title, description, action, size = "md", ...props },
    ref
  ) => {
    const config = VARIANT_CONFIG[variant];
    const Icon = config.icon;

    const sizeClasses = {
      sm: {
        container: "py-8 px-4",
        icon: "w-10 h-10",
        iconWrapper: "w-14 h-14",
        title: "text-base",
        description: "text-sm",
      },
      md: {
        container: "py-12 px-6",
        icon: "w-12 h-12",
        iconWrapper: "w-20 h-20",
        title: "text-lg",
        description: "text-sm",
      },
      lg: {
        container: "py-16 px-8",
        icon: "w-16 h-16",
        iconWrapper: "w-24 h-24",
        title: "text-xl",
        description: "text-base",
      },
    };

    const sizes = sizeClasses[size];

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center justify-center text-center",
          sizes.container,
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "rounded-full bg-muted flex items-center justify-center mb-4",
            sizes.iconWrapper
          )}
        >
          {icon || <Icon className={cn("text-muted-foreground", sizes.icon)} />}
        </div>

        <h3 className={cn("font-semibold text-foreground mb-1", sizes.title)}>
          {title || config.defaultTitle}
        </h3>

        <p className={cn("text-muted-foreground max-w-sm mb-4", sizes.description)}>
          {description || config.defaultDescription}
        </p>

        {action && <div className="mt-2">{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
