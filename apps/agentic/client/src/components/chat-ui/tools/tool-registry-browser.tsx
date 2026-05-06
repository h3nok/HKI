/**
 * ToolRegistryBrowser - Interactive Tool Discovery & Documentation
 *
 * Displays all available tools that agents can use, with:
 * - Tool descriptions and parameters
 * - Usage statistics and examples
 * - Interactive testing interface
 * - Real-time availability status
 *
 * Features:
 * - Search and filter tools
 * - View tool schemas
 * - See usage frequency
 * - Test tools with sample inputs
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Wrench,
  Database,
  Code,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Play,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@hki/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@hki/ui";

// ============================================================================
// TYPES
// ============================================================================

export type ToolCategory =
  | "search"
  | "data"
  | "compute"
  | "communication"
  | "other";
export type ToolStatus = "available" | "unavailable" | "deprecated";

export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: any;
}

export interface ToolUsageStats {
  totalCalls: number;
  successRate: number;
  avgDuration: number; // milliseconds
  lastUsed?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  status: ToolStatus;
  parameters: ToolParameter[];
  returns: string;
  example?: {
    input: Record<string, any>;
    output: any;
  };
  stats?: ToolUsageStats;
}

export interface ToolRegistryBrowserProps {
  tools: Tool[];
  onTestTool?: (toolId: string, input: Record<string, any>) => Promise<any>;
}

// ============================================================================
// DESIGN CONFIG
// ============================================================================

const categoryConfig = {
  search: {
    icon: Search,
    color: "var(--primary)",
    label: "Search",
  },
  data: {
    icon: Database,
    color: "#16a34a",
    label: "Data",
  },
  compute: {
    icon: Code,
    color: "#8b5cf6",
    label: "Compute",
  },
  communication: {
    icon: TrendingUp,
    color: "var(--primary)",
    label: "Communication",
  },
  other: {
    icon: Wrench,
    color: "var(--muted-foreground)",
    label: "Other",
  },
};

const statusConfig = {
  available: {
    icon: CheckCircle2,
    color: "#16a34a",
    label: "Available",
  },
  unavailable: {
    icon: XCircle,
    color: "var(--destructive)",
    label: "Unavailable",
  },
  deprecated: {
    icon: XCircle,
    color: "var(--primary)",
    label: "Deprecated",
  },
};

// ============================================================================
// COMPONENTS
// ============================================================================

function ToolCard({
  tool,
  onTest,
}: {
  tool: Tool;
  onTest?: (tool: Tool) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedExample, setCopiedExample] = useState(false);

  const categoryConfig_ = categoryConfig[tool.category];
  const statusConfig_ = statusConfig[tool.status];
  const CategoryIcon = categoryConfig_.icon;
  const StatusIcon = statusConfig_.icon;

  const handleCopyExample = async () => {
    if (tool.example) {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(tool.example.input, null, 2)
        );
      } catch {
        console.warn("[Clipboard] writeText failed");
      }
      setCopiedExample(true);
      setTimeout(() => setCopiedExample(false), 2000);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border overflow-hidden"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-primary/5 transition-colors"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${tool.name} — ${isExpanded ? "collapse" : "expand"} details`}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className="p-2 rounded-lg shrink-0"
            style={{
              background: `color-mix(in srgb, ${categoryConfig_.color} 15%, transparent)`,
            }}
          >
            <CategoryIcon
              className="h-4 w-4"
              style={{ color: categoryConfig_.color }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4
                className="font-semibold text-sm"
                style={{ color: "var(--foreground)" }}
              >
                {tool.name}
              </h4>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className="text-xs"
                  style={{
                    borderColor: statusConfig_.color,
                    color: statusConfig_.color,
                  }}
                >
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig_.label}
                </Badge>
                {isExpanded ? (
                  <ChevronDown
                    className="h-4 w-4"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                ) : (
                  <ChevronRight
                    className="h-4 w-4"
                    style={{ color: "var(--muted-foreground)" }}
                  />
                )}
              </div>
            </div>

            <p
              className="text-xs mb-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              {tool.description}
            </p>

            {/* Stats */}
            {tool.stats && (
              <div className="flex items-center gap-4 text-xs">
                <div style={{ color: "var(--muted-foreground)" }}>
                  <TrendingUp className="h-3 w-3 inline mr-1" />
                  {tool.stats.totalCalls} calls
                </div>
                <div style={{ color: "#16a34a" }}>
                  {Math.round(tool.stats.successRate * 100)}% success
                </div>
                <div style={{ color: "var(--muted-foreground)" }}>
                  {tool.stats.avgDuration}ms avg
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t overflow-hidden"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="p-4 space-y-4">
              {/* Parameters */}
              <div>
                <h5
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Parameters
                </h5>
                <div className="space-y-2">
                  {tool.parameters.map(param => (
                    <div
                      key={param.name}
                      className="flex items-start gap-2 text-xs p-2 rounded-lg"
                      style={{ background: "var(--muted)" }}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <code
                            className="font-mono font-semibold"
                            style={{ color: "var(--foreground)" }}
                          >
                            {param.name}
                          </code>
                          <code
                            className="font-mono text-xs"
                            style={{ color: "var(--muted-foreground)" }}
                          >
                            {param.type}
                          </code>
                          {param.required && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-1 py-0"
                            >
                              required
                            </Badge>
                          )}
                        </div>
                        <p style={{ color: "var(--muted-foreground)" }}>
                          {param.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Returns */}
              <div>
                <h5
                  className="text-xs font-semibold mb-2"
                  style={{ color: "var(--foreground)" }}
                >
                  Returns
                </h5>
                <code
                  className="block text-xs p-2 rounded-lg font-mono"
                  style={{
                    background: "var(--muted)",
                    color: "var(--foreground)",
                  }}
                >
                  {tool.returns}
                </code>
              </div>

              {/* Example */}
              {tool.example && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5
                      className="text-xs font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      Example
                    </h5>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={handleCopyExample}
                    >
                      {copiedExample ? (
                        <Check className="h-3 w-3 mr-1" />
                      ) : (
                        <Copy className="h-3 w-3 mr-1" />
                      )}
                      Copy
                    </Button>
                  </div>
                  <pre
                    className="text-xs p-3 rounded-lg overflow-x-auto font-mono"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                    }}
                  >
                    {JSON.stringify(tool.example, null, 2)}
                  </pre>
                </div>
              )}

              {/* Test Button */}
              {onTest && tool.status === "available" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => onTest(tool)}
                >
                  <Play className="h-3.5 w-3.5 mr-2" />
                  Test Tool
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ToolRegistryBrowser({
  tools,
  onTestTool,
}: ToolRegistryBrowserProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<ToolStatus | "all">("all");

  const filteredTools = useMemo(() => {
    return tools.filter(tool => {
      const matchesSearch =
        searchQuery === "" ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || tool.category === categoryFilter;

      const matchesStatus =
        statusFilter === "all" || tool.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [tools, searchQuery, categoryFilter, statusFilter]);

  const handleTestTool = async (tool: Tool) => {
    if (onTestTool && tool.example) {
      await onTestTool(tool.id, tool.example.input);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="p-1.5 rounded-lg"
          style={{
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
        >
          <Wrench className="h-4 w-4" style={{ color: "var(--primary)" }} />
        </div>
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--foreground)" }}
        >
          Tool Registry
        </h3>
        <Badge variant="secondary" className="ml-auto">
          {filteredTools.length} tools
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--muted-foreground)" }}
          />
          <Input
            placeholder="Search tools..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={v => setCategoryFilter(v as any)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(categoryConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={v => setStatusFilter(v as any)}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tool List */}
      <div className="space-y-2">
        {filteredTools.length === 0 ? (
          <div
            className="text-center py-12"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tools found</p>
          </div>
        ) : (
          filteredTools.map(tool => (
            <ToolCard
              key={tool.id}
              tool={tool}
              onTest={onTestTool ? handleTestTool : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
