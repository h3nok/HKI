'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const iconActionVariants = cva(
  'inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'hover:text-foreground hover:bg-muted',
        primary: 'hover:text-primary hover:bg-primary/10',
        success: 'hover:text-emerald-600 hover:bg-emerald-500/10',
        destructive: 'hover:text-destructive hover:bg-destructive/10',
      },
      size: {
        sm: 'p-1.5 [&_svg]:size-3.5',
        md: 'p-2 [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  }
);

interface IconActionBaseProps extends VariantProps<typeof iconActionVariants> {
  /** Accessible label — used as aria-label and tooltip text */
  label: string;
  icon: React.ReactNode;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

type IconActionButtonProps = IconActionBaseProps & {
  href?: never;
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type IconActionLinkProps = IconActionBaseProps & {
  href: string;
  onClick?: never;
  disabled?: never;
};

export type IconActionProps = IconActionButtonProps | IconActionLinkProps;

/**
 * An icon-only action button or link with a styled Radix tooltip.
 * Handles keyboard focus, screen readers, and hover state consistently.
 *
 * @example
 * // Button
 * <IconAction icon={<Pencil />} label="Edit" variant="default" onClick={handleEdit} />
 *
 * // Link
 * <IconAction icon={<MessageSquare />} label="Launch Chat" variant="primary" href="/chat?scope=foo" />
 *
 * // Destructive
 * <IconAction icon={<Trash2 />} label="Delete" variant="destructive" onClick={handleDelete} />
 */
export const IconAction = React.forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  IconActionProps
>(({ icon, label, variant, size, tooltipSide = 'top', className, ...rest }, ref) => {
  const sharedClass = cn(iconActionVariants({ variant, size }), className);

  const trigger =
    'href' in rest && rest.href ? (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={rest.href}
        aria-label={label}
        className={sharedClass}
      >
        {icon}
      </a>
    ) : (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        aria-label={label}
        className={sharedClass}
        {...(rest as Omit<IconActionButtonProps, keyof IconActionBaseProps>)}
      >
        {icon}
      </button>
    );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
});

IconAction.displayName = 'IconAction';
