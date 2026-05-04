import * as React from 'react';
import { Button, type ButtonProps } from '@hki/ui';
import { cn } from '@hki/ui';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

/**
 * ToolbarAction — standardised header/toolbar button.
 *
 * Wraps the shared `Button` primitive with a consistent blue-hover
 * treatment for all toolbar/header actions. One component, one place
 * to update — prevents the "some buttons hover gray, some blue" drift.
 *
 * Pass `tooltip` for a styled Radix tooltip (replaces raw `title`).
 */
export interface ToolbarActionProps extends Omit<ButtonProps, 'variant'> {
    /** Whether this action is currently "on" / active */
    active?: boolean;
    /** Styled tooltip text — replaces native title attribute */
    tooltip?: string;
    /** Tooltip placement */
    tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
}

/** Shared override: blue hover instead of gray accent */
const TOOLBAR_CLASSES =
    'text-muted-foreground hover:bg-primary/8 hover:text-primary focus-visible:ring-primary/50';

const ToolbarAction = React.forwardRef<HTMLButtonElement, ToolbarActionProps>(
    ({ className, size = 'sm', active = false, tooltip, tooltipSide = 'bottom', title: _title, ...props }, ref) => {
        const button = (
            <Button
                ref={ref}
                variant="ghost"
                size={size}
                className={cn(
                    TOOLBAR_CLASSES,
                    'transition-all duration-200',
                    active && 'bg-primary/10 text-primary',
                    className,
                )}
                {...props}
            />
        );

        if (!tooltip) return button;

        return (
            <Tooltip>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
            </Tooltip>
        );
    },
);
ToolbarAction.displayName = 'ToolbarAction';

export { ToolbarAction };
