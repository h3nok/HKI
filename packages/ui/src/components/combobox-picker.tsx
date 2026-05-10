"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";
import { cn } from "../utils";

/* ── Types ────────────────────────────────────────────────────────── */

export interface ComboboxPickerOption<T extends string = string> {
  /** Unique value for this option */
  value: T;
  /** Display label (defaults to value if omitted) */
  label?: string;
  /** Optional icon / preview rendered to the left of the label */
  icon?: React.ReactNode;
  /** Optional secondary text below the label */
  description?: string;
  /** If true, the option cannot be selected */
  disabled?: boolean;
}

export interface ComboboxPickerProps<T extends string = string> {
  /** The current selected value */
  value: T;
  /** Called when the user selects a new value */
  onChange: (value: T) => void;
  /** Available options */
  options: ComboboxPickerOption<T>[];
  /** Placeholder when nothing is selected */
  placeholder?: string;
  /** Enable search filtering (defaults to true when > 8 options) */
  searchable?: boolean;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Render a custom trigger (overrides the default button) */
  renderTrigger?: (option: ComboboxPickerOption<T> | undefined, open: boolean) => React.ReactNode;
  /** Render a custom option row */
  renderOption?: (option: ComboboxPickerOption<T>, selected: boolean) => React.ReactNode;
  /** Render a custom selected-value display inside the default trigger */
  renderValue?: (option: ComboboxPickerOption<T>) => React.ReactNode;
  /** Additional className for the trigger button */
  triggerClassName?: string;
  /** Additional className for the dropdown panel */
  contentClassName?: string;
  /** Max height for the options list (default 280px) */
  maxHeight?: number;
  /** Disabled state */
  disabled?: boolean;
}

/* ── Component ────────────────────────────────────────────────────── */

/**
 * A styled, searchable dropdown picker with support for icons, custom
 * item rendering, and rich selected-item display.
 *
 * Uses a lightweight portal + manual positioning so the dropdown escapes
 * overflow:hidden / overflow:auto ancestors (works inside modals).
 *
 * @example
 * ```tsx
 * <ComboboxPicker
 *   value={icon}
 *   onChange={setIcon}
 *   options={ICONS.map(k => ({ value: k, icon: getIcon(k) }))}
 *   searchPlaceholder="Search icons..."
 * />
 * ```
 */
export function ComboboxPicker<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable,
  searchPlaceholder = "Search…",
  renderTrigger,
  renderOption,
  renderValue,
  triggerClassName,
  contentClassName,
  maxHeight = 280,
  disabled = false,
}: ComboboxPickerProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0 });
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        (o.label ?? o.value).toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
    );
  }, [options, query]);

  // Measure trigger position when opening
  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (open && showSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
    if (!open) setQuery("");
    return undefined;
  }, [open, showSearch]);

  // Close on click outside (check both trigger and dropdown)
  React.useEffect(() => {
    if (!open) return undefined;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [open]);

  // Re-position on scroll / resize while open
  React.useEffect(() => {
    if (!open) return undefined;
    const handle = () => updatePosition();
    window.addEventListener("scroll", handle, true);
    window.addEventListener("resize", handle, true);
    return () => {
      window.removeEventListener("scroll", handle, true);
      window.removeEventListener("resize", handle, true);
    };
  }, [open, updatePosition]);

  const handleSelect = (val: T) => {
    onChange(val);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (disabled) return;
    if (!open) updatePosition();
    setOpen((prev) => !prev);
  };

  /* ── Keyboard navigation ─────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]:not([disabled])'
      );
      if (!items?.length) return;
      const active = document.activeElement;
      const idx = Array.from(items).indexOf(active as HTMLButtonElement);
      const next =
        e.key === "ArrowDown"
          ? items[Math.min(idx + 1, items.length - 1)]
          : items[Math.max(idx - 1, 0)];
      next?.focus();
    }
    if (e.key === "Enter") {
      const active = document.activeElement;
      if (active instanceof HTMLButtonElement && active.dataset.value) {
        handleSelect(active.dataset.value as T);
      }
    }
  };

  /* ── Dropdown rendered via portal ────────────────────────────── */
  const dropdown =
    open &&
    createPortal(
      <div
        ref={dropdownRef}
        onKeyDown={handleKeyDown}
        className={cn(
          "fixed rounded-lg border shadow-lg overflow-hidden",
          "border-[#e0dfdc] dark:border-[#333333]",
          "bg-white dark:bg-[#1e1e1e]",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          contentClassName,
        )}
        style={{
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 99999,
        }}
      >
        {/* Search */}
        {showSearch && (
          <div className="p-2 border-b border-[#eae9e6] dark:border-[#2a2a2a]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8a8986] dark:text-[#6f6e6b]" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-[#f5f4f1] dark:bg-[#161616] border border-[#e0dfdc] dark:border-[#333333] rounded-md text-[#3f3e3d] dark:text-[#d1d0cd] placeholder-[#8a8986] dark:placeholder-[#6f6e6b] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#0E7C7B] dark:focus-visible:ring-[#1FA9A5] transition-all"
              />
            </div>
          </div>
        )}

        {/* Options list */}
        <div
          ref={listRef}
          role="listbox"
          className="overflow-y-auto p-1"
          style={{ maxHeight }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-[#8a8986] dark:text-[#6f6e6b]">
              No results
            </div>
          ) : (
            filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-value={option.value}
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm text-left transition-colors",
                    "focus:outline-none focus-visible:bg-[#f3f2ef] dark:focus-visible:bg-[#242424]",
                    isSelected
                      ? "bg-[#D5F8F5] dark:bg-[#0E7C7B]/10 text-[#0E7C7B] dark:text-[#3DCBC6]"
                      : "text-[#3f3e3d] dark:text-[#d1d0cd] hover:bg-[#f3f2ef] dark:hover:bg-[#242424]",
                    option.disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {renderOption ? (
                    renderOption(option, isSelected)
                  ) : (
                    <>
                      {option.icon && (
                        <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                          {option.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">
                        <span className="font-medium">{option.label ?? option.value}</span>
                        {option.description && (
                          <span className="block text-xs text-[#8a8986] dark:text-[#6f6e6b] truncate">
                            {option.description}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 shrink-0 text-[#0E7C7B] dark:text-[#3DCBC6]" />
                      )}
                    </>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>,
      document.body,
    );

  return (
    <div>
      {/* ── Trigger ─────────────────────────────────────────────── */}
      {renderTrigger ? (
        <div ref={triggerRef as React.RefObject<HTMLDivElement | null>} onClick={toggleOpen}>
          {renderTrigger(selected, open)}
        </div>
      ) : (
        <button
          ref={triggerRef as React.RefObject<HTMLButtonElement | null>}
          type="button"
          disabled={disabled}
          onClick={toggleOpen}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-sm text-left transition-all",
            "border-[#e0dfdc] dark:border-[#333333]",
            "bg-[#faf9f7] dark:bg-[#1a1a1a]",
            "text-[#3f3e3d] dark:text-[#d1d0cd]",
            "hover:border-[#0E7C7B]/40 dark:hover:border-[#1FA9A5]/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] dark:focus-visible:ring-[#1FA9A5]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            triggerClassName,
          )}
        >
          {selected ? (
            renderValue ? (
              renderValue(selected)
            ) : (
              <>
                {selected.icon && (
                  <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#525150] dark:text-[#a3a29f]">
                    {selected.icon}
                  </span>
                )}
                <span className="truncate flex-1 font-medium">
                  {selected.label ?? selected.value}
                </span>
              </>
            )
          ) : (
            <span className="text-[#8a8986] dark:text-[#6f6e6b] truncate flex-1">
              {placeholder}
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 shrink-0 text-[#8a8986] dark:text-[#6f6e6b] transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      )}

      {dropdown}
    </div>
  );
}
