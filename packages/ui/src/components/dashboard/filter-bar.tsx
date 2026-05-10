import { cn } from "../../utils";

export interface FilterOption {
  /** Value used internally */
  value: string;
  /** Display label */
  label: string;
}

export interface FilterBarProps {
  /** Current search query */
  searchQuery: string;
  /** Called when the search query changes */
  onSearchChange: (value: string) => void;
  /** Search input placeholder */
  searchPlaceholder?: string;
  /** Filter options (first is treated as "all") */
  options: FilterOption[];
  /** Currently active filter value */
  activeFilter: string;
  /** Called when the filter selection changes */
  onFilterChange: (value: string) => void;
  /** Result count when filters are active */
  resultCount?: number;
  /** Total unfiltered count */
  totalCount?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Search + segmented filter bar.
 * Combines a search input with a pill-style segmented control.
 *
 * @example
 * <FilterBar
 *   searchQuery={q}
 *   onSearchChange={setQ}
 *   options={[{ value: "all", label: "All" }, { value: "mvp", label: "MVP" }]}
 *   activeFilter={filter}
 *   onFilterChange={setFilter}
 * />
 */
export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search…",
  options,
  activeFilter,
  onFilterChange,
  resultCount,
  totalCount,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center gap-3", className)}>
      <div className="relative w-full sm:w-48">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8986] dark:text-[#6f6e6b]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full h-10 pl-10 pr-4 rounded-lg border border-[#e0dfdc] dark:border-[#333333] bg-white dark:bg-[#1a1a1a] text-[#3f3e3d] dark:text-[#d1d0cd] placeholder-[#8a8986] dark:placeholder-[#6f6e6b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] dark:focus-visible:ring-[#1FA9A5] focus:border-[#0E7C7B] dark:focus:border-[#1FA9A5] transition-all text-sm"
          aria-label="Search"
        />
      </div>

      <div className="flex items-center gap-1 bg-[#f3f2ef] dark:bg-[#1a1a1a] rounded-lg p-1 border border-[#e0dfdc] dark:border-[#333333]" role="group" aria-label="Filter options">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onFilterChange(opt.value)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] dark:focus-visible:ring-[#1FA9A5] focus-visible:ring-offset-1",
              activeFilter === opt.value
                ? "bg-white dark:bg-[#242424] text-[#1a1a19] dark:text-[#f5f4f1] shadow-sm"
                : "text-[#6f6e6b] dark:text-[#a3a29f] hover:text-[#3f3e3d] dark:hover:text-[#d1d0cd]"
            )}
            aria-pressed={activeFilter === opt.value}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {resultCount !== undefined &&
        totalCount !== undefined &&
        (searchQuery || activeFilter !== options[0]?.value) && (
          <span className="text-sm text-[#8a8986] dark:text-[#6f6e6b] self-center tabular-nums">
            {resultCount} / {totalCount}
          </span>
        )}
    </div>
  );
}
