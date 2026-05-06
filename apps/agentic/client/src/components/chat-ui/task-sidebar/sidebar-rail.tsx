/**
 * SidebarRail — Invisible clickable edge strip to toggle sidebar
 * 
 * Features:
 * - Positioned at the right edge of the sidebar (or left edge when collapsed)
 * - Shows a subtle line on hover
 * - Click to toggle sidebar open/closed
 * - Cursor changes to indicate resize action
 */

import { cn } from '@hki/ui';

export interface SidebarRailProps {
    isOpen: boolean;
    onToggle: () => void;
    className?: string;
}

export function SidebarRail({ isOpen, onToggle, className }: SidebarRailProps) {
    return (
        <button
            type="button"
            aria-label="Toggle Sidebar"
            tabIndex={-1}
            onClick={onToggle}
            title="Toggle Sidebar"
            className={cn(
                // Base positioning - thin strip on the right edge
                "absolute inset-y-0 z-30 w-4 -translate-x-1/2",
                // Position based on sidebar state
                isOpen ? "-right-2" : "right-0 translate-x-full",
                // Invisible, no line on hover - just clickable area
                "transition-all ease-linear",
                // Cursor indicates toggle action
                isOpen ? "cursor-w-resize" : "cursor-e-resize",
                // Hit area extension
                "before:absolute before:inset-y-0 before:-left-2 before:-right-2",
                className
            )}
        />
    );
}
