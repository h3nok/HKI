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
          "border-[#a7f3d0] dark:border-[#065f46] bg-[#ecfdf5] dark:bg-[#064e3b]/20 text-[#065f46] dark:text-[#6ee7b7] shadow-sm",
        warning:
          "border-[#fde68a] dark:border-[#78350f] bg-[#fffbeb] dark:bg-[#78350f]/20 text-[#92400e] dark:text-[#fcd34d] shadow-sm",
        "hki-blue":
          "border-[#99CBEB]/40 dark:border-[#00528E]/40 bg-[#E6F2FA] dark:bg-[#0066B2]/10 text-[#0066B2] dark:text-[#66B1E1] shadow-sm",
        "hki-red":
          "border-[#F9D1D9]/40 dark:border-[#880E21]/40 bg-[#FCE8EC] dark:bg-[#E31837]/10 text-[#E31837] dark:text-[#F3A3B3] shadow-sm",
        brand:
          "border-transparent bg-linear-to-r from-[#0066B2] to-[#004A82] text-white shadow-sm",
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
