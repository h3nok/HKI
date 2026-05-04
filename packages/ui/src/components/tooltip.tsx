"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "../utils";

const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{ zIndex: 1300, ...props.style }}
      className={cn(
        "overflow-hidden rounded-md px-3 py-1.5 text-xs font-bold tracking-widest uppercase",
        "bg-popover/85 backdrop-blur-2xl border border-primary/30 text-popover-foreground shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
        "shadow-lg animate-in fade-in-0 zoom-in-95",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-4 data-[side=left]:slide-in-from-right-4",
        "data-[side=right]:slide-in-from-left-4 data-[side=top]:slide-in-from-bottom-4",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
