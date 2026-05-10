"use client";

import * as React from "react";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] overflow-hidden transition-all duration-200",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/15 backdrop-blur-md text-primary shadow-sm hover:bg-primary/25 font-bold tracking-widest uppercase",
        secondary:
          "border-transparent bg-secondary/80 backdrop-blur-md text-secondary-foreground shadow-sm hover:bg-secondary/90 font-bold tracking-widest uppercase",
        destructive:
          "border-transparent bg-destructive/15 backdrop-blur-md text-destructive shadow-sm hover:bg-destructive/25 font-bold tracking-widest uppercase",
        outline: "border-border/40 text-foreground hover:bg-accent/50 backdrop-blur-sm font-bold tracking-widest uppercase",
        accent: "border-transparent bg-accent/80 backdrop-blur-md text-accent-foreground shadow-sm hover:bg-accent/90 font-bold tracking-widest uppercase",
        success:
          "border-primary/25 bg-primary/10 text-primary shadow-sm",
        warning:
          "border-primary/25 bg-primary/10 text-primary shadow-sm",
        "hki-blue":
          "border-primary/25 bg-primary/10 text-primary shadow-sm",
        "hki-red":
          "border-primary/25 bg-primary/10 text-primary shadow-sm",
        brand:
          "border-transparent bg-primary text-white shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
