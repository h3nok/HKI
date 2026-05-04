'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Menu, Search, Command as CommandIcon } from 'lucide-react';
import { cn } from '../utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

/* ═══════════════════════════════════════════════════════════════════════════
   TOPBAR COMPONENT
   
   Height: 60px (fixed)
   Contains: Navigation toggle, Search, Actions, User Menu
   
   Based on Layout Patterns & Grid System spec
   ═══════════════════════════════════════════════════════════════════════════ */

const topbarVariants = cva(
  'flex items-center justify-between h-[60px] px-4 lg:px-6 border-b bg-background sticky top-0 z-sticky',
  {
    variants: {
      variant: {
        default: 'border-border',
        transparent: 'bg-transparent border-transparent',
        blur: 'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-neutral-200/50 dark:border-neutral-800/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface TopbarProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof topbarVariants> {
  /** Show mobile menu trigger */
  showMenuTrigger?: boolean;
  /** Callback when menu trigger is clicked */
  onMenuTriggerClick?: () => void;
  /** Left side content (after menu trigger) */
  leftContent?: React.ReactNode;
  /** Center content (typically search) */
  centerContent?: React.ReactNode;
  /** Right side actions (before user menu) */
  actions?: React.ReactNode;
  /** User information for the user menu */
  user?: {
    name: string;
    email?: string;
    avatar?: string;
    initials?: string;
  };
  /** User menu items */
  userMenuItems?: React.ReactNode;
  /** Callback when sign out is clicked */
  onSignOut?: () => void;
}

export function Topbar({
  className,
  variant,
  showMenuTrigger = true,
  onMenuTriggerClick,
  leftContent,
  centerContent,
  actions,
  user,
  userMenuItems,
  onSignOut,
  ...props
}: TopbarProps) {
  return (
    <header className={cn(topbarVariants({ variant }), className)} {...props}>
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {showMenuTrigger && (
          <button
            onClick={onMenuTriggerClick}
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 transition-colors lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        {leftContent}
      </div>

      {/* Center Section */}
      {centerContent && (
        <div className="flex-1 max-w-xl mx-4 hidden md:block">
          {centerContent}
        </div>
      )}

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {actions}

        {user && (
          <>
            <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-2 hidden md:block" />
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-accent transition-colors">
                  <Avatar className="h-8 w-8 border border-neutral-200 dark:border-neutral-700">
                    {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                    <AvatarFallback className="bg-hki-blue-500 text-white text-xs font-medium">
                      {user.initials || user.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden lg:flex flex-col items-start">
                    <span className="text-sm font-medium text-foreground">
                      {user.name}
                    </span>
                    {user.email && (
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{user.name}</span>
                    {user.email && (
                      <span className="text-xs text-neutral-500 font-normal">{user.email}</span>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {userMenuItems}
                {onSignOut && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={onSignOut}
                      className="text-red-600 dark:text-red-400 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                    >
                      Sign out
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOPBAR SEARCH
   ═══════════════════════════════════════════════════════════════════════════ */

interface TopbarSearchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCommandClick?: () => void;
}

export function TopbarSearch({ className, onCommandClick }: TopbarSearchProps) {
  return (
    <button
      onClick={onCommandClick}
      className={cn(
        'flex items-center gap-3 w-full px-4 py-2 rounded-lg',
        'bg-muted',
        'text-muted-foreground',
        'hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors',
        'text-sm',
        className
      )}
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search...</span>
      <kbd className="hidden lg:flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-neutral-200 dark:border-neutral-700 text-xs font-mono">
        <CommandIcon className="h-3 w-3" />
        <span>K</span>
      </kbd>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOPBAR ACTION BUTTON
   ═══════════════════════════════════════════════════════════════════════════ */

interface TopbarActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  badge?: number | boolean;
  label: string;
}

export function TopbarAction({ 
  icon, 
  badge, 
  label, 
  className, 
  ...props 
}: TopbarActionProps) {
  return (
    <button
      className={cn(
        'relative p-2 rounded-lg text-muted-foreground',
        'hover:text-neutral-900 dark:hover:text-neutral-100',
        'hover:bg-accent',
        'transition-colors',
        className
      )}
      aria-label={label}
      {...props}
    >
      {icon}
      {badge && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-hki-red-500" />
      )}
    </button>
  );
}

export { topbarVariants };
