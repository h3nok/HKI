"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "../utils";
import { Dialog, DialogContent } from "./dialog";

/* ═══════════════════════════════════════════════════════════════════════════
   COMMAND COMPONENT

   Command palette / search component (⌘K pattern).
   Migrated from legacy bundle with HKI brand styling.

   NOTE: Type annotations use plain HTML element types to avoid TS2742
   errors caused by cmdk depending on @types/react@18 while this package
   uses @types/react@19. The runtime props are fully compatible.
   ═══════════════════════════════════════════════════════════════════════════ */

type CommandProps = React.ComponentPropsWithoutRef<"div"> & {
  label?: string;
  shouldFilter?: boolean;
  filter?: (value: string, search: string, keywords?: string[]) => number;
  value?: string;
  onValueChange?: (value: string) => void;
  loop?: boolean;
  disablePointerSelection?: boolean;
  vimBindings?: boolean;
};

const Command = React.forwardRef<HTMLDivElement, CommandProps>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive
      ref={ref as any}
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-xl",
        "bg-background text-foreground",
        className
      )}
      {...(props as any)}
    />
  )
);
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CommandDialog = ({ children, ...props }: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0 shadow-2xl">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-neutral-500 dark:[&_[cmdk-group-heading]]:text-neutral-400 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

type CommandInputProps = React.ComponentPropsWithoutRef<"input">;

const CommandInput = React.forwardRef<HTMLInputElement, CommandInputProps>(
  ({ className, ...props }, ref) => (
    <div
      className="flex items-center border-b border-border px-3"
      cmdk-input-wrapper=""
    >
      <Search className="mr-2 h-4 w-4 shrink-0 text-neutral-400" />
      <CommandPrimitive.Input
        ref={ref as any}
        className={cn(
          "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none",
          "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...(props as any)}
      />
    </div>
  )
);
CommandInput.displayName = CommandPrimitive.Input.displayName;

type CommandListProps = React.ComponentPropsWithoutRef<"div">;

const CommandList = React.forwardRef<HTMLDivElement, CommandListProps>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive.List
      ref={ref as any}
      className={cn(
        "max-h-[300px] overflow-y-auto overflow-x-hidden",
        className
      )}
      {...(props as any)}
    />
  )
);
CommandList.displayName = CommandPrimitive.List.displayName;

type CommandEmptyProps = React.ComponentPropsWithoutRef<"div">;

const CommandEmpty = React.forwardRef<HTMLDivElement, CommandEmptyProps>(
  (props, ref) => (
    <CommandPrimitive.Empty
      ref={ref as any}
      className="py-6 text-center text-sm text-neutral-500"
      {...(props as any)}
    />
  )
);
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

type CommandGroupProps = React.ComponentPropsWithoutRef<"div"> & {
  heading?: React.ReactNode;
  value?: string;
  forceMount?: boolean;
};

const CommandGroup = React.forwardRef<HTMLDivElement, CommandGroupProps>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive.Group
      ref={ref as any}
      className={cn(
        "overflow-hidden p-1 text-foreground",
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-neutral-500 dark:[&_[cmdk-group-heading]]:text-neutral-400",
        className
      )}
      {...(props as any)}
    />
  )
);
CommandGroup.displayName = CommandPrimitive.Group.displayName;

type CommandSeparatorProps = React.ComponentPropsWithoutRef<"div"> & {
  alwaysRender?: boolean;
};

const CommandSeparator = React.forwardRef<
  HTMLDivElement,
  CommandSeparatorProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref as any}
    className={cn("-mx-1 h-px bg-neutral-200 dark:bg-neutral-800", className)}
    {...(props as any)}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

type CommandItemProps = React.ComponentPropsWithoutRef<"div"> & {
  disabled?: boolean;
  onSelect?: (value: string) => void;
  value?: string;
  keywords?: string[];
  forceMount?: boolean;
};

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive.Item
      ref={ref as any}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none",
        "aria-selected:bg-hki-blue-50 dark:aria-selected:bg-hki-blue-950 aria-selected:text-hki-blue-900 dark:aria-selected:text-hki-blue-100",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className
      )}
      {...(props as any)}
    />
  )
);
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-neutral-400",
        className
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};

export type {
  CommandProps,
  CommandDialogProps,
  CommandInputProps,
  CommandListProps,
  CommandEmptyProps,
  CommandGroupProps,
  CommandSeparatorProps,
  CommandItemProps,
};
