"use client";

/**
 * JsonViewer - World-Class JSON Display Component
 *
 * Features:
 * - CSS variable theming for light/dark modes
 * - Smooth expand/collapse animations
 * - Syntax highlighting with semantic colors
 * - Copy functionality
 */

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Check,
  Braces,
  Brackets,
} from "lucide-react";
import { cn } from "@hki/ui";
import type { JsonValue } from "../types";

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const TOKENS = {
  colors: {
    string: "var(--success, #16a34a)",
    number: "var(--primary)",
    boolean: "var(--info, var(--primary))",
    null: "var(--primary)",
    key: "var(--muted-foreground)",
    bracket: "color-mix(in srgb, var(--foreground) 50%, transparent)",
  },
  animation: {
    duration: 0.15,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
} as const;

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function CopyButton({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      console.warn("[Clipboard] writeText failed");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.button
      type="button"
      onClick={handleCopy}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={cn("p-1 rounded-md transition-colors", className)}
      style={{
        background: copied
          ? "color-mix(in srgb, var(--success, #16a34a) 15%, transparent)"
          : "transparent",
      }}
      title={copied ? "Copied!" : "Copy"}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
    >
      {copied ? (
        <Check
          className="h-3 w-3"
          style={{ color: "var(--success, #16a34a)" }}
        />
      ) : (
        <Copy
          className="h-3 w-3"
          style={{ color: "var(--muted-foreground)" }}
        />
      )}
    </motion.button>
  );
}

function serializeValue(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}

// ============================================================================
// JSON NODE
// ============================================================================

type JsonNodeProps = {
  data: JsonValue;
  keyName?: string;
  level?: number;
  currentDepth?: number;
  maxOpenDepth?: number;
  forceExpandState?: boolean | null;
};

function JsonNode({
  data,
  keyName,
  level = 0,
  currentDepth = 0,
  maxOpenDepth = 0,
  forceExpandState = null,
}: JsonNodeProps) {
  const shouldExpand = maxOpenDepth < 0 || currentDepth < maxOpenDepth;
  const [isExpanded, setIsExpanded] = useState(
    forceExpandState !== null ? forceExpandState : shouldExpand
  );

  const indent = level * 16;
  const copyContent = keyName
    ? `${keyName}: ${serializeValue(data)}`
    : serializeValue(data);

  // Handle arrays
  if (Array.isArray(data) && data.length > 0) {
    return (
      <div style={{ marginLeft: level > 0 ? 16 : 0 }}>
        <div className="group/line flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors hover:bg-primary/5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex flex-1 items-center gap-1 font-mono text-xs"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.1 }}
              className="flex h-4 w-4 items-center justify-center"
            >
              <ChevronDown
                className="h-3 w-3"
                style={{ color: "var(--muted-foreground)" }}
              />
            </motion.div>
            {keyName && (
              <span style={{ color: TOKENS.colors.key }}>{keyName}: </span>
            )}
            <Brackets
              className="h-3 w-3"
              style={{ color: TOKENS.colors.bracket }}
            />
            <span style={{ color: "var(--muted-foreground)" }}>
              {data.length} item{data.length !== 1 ? "s" : ""}
            </span>
          </button>
          <div className="opacity-0 transition-opacity group-hover/line:opacity-100">
            <CopyButton content={copyContent} />
          </div>
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: TOKENS.animation.duration }}
            >
              {data.map((item, index) => (
                <JsonNode
                  key={index}
                  data={item}
                  level={level + 1}
                  currentDepth={currentDepth + 1}
                  maxOpenDepth={maxOpenDepth}
                  forceExpandState={forceExpandState}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Handle objects
  if (
    typeof data === "object" &&
    data !== null &&
    Object.keys(data).length > 0
  ) {
    const entries = Object.entries(data);
    return (
      <div style={{ marginLeft: level > 0 ? 16 : 0 }}>
        <div className="group/line flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors hover:bg-primary/5">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex flex-1 items-center gap-1 font-mono text-xs"
          >
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.1 }}
              className="flex h-4 w-4 items-center justify-center"
            >
              <ChevronDown
                className="h-3 w-3"
                style={{ color: "var(--muted-foreground)" }}
              />
            </motion.div>
            {keyName && (
              <span style={{ color: TOKENS.colors.key }}>{keyName}: </span>
            )}
            <Braces
              className="h-3 w-3"
              style={{ color: TOKENS.colors.bracket }}
            />
            <span style={{ color: "var(--muted-foreground)" }}>
              {entries.length} key{entries.length !== 1 ? "s" : ""}
            </span>
          </button>
          <div className="opacity-0 transition-opacity group-hover/line:opacity-100">
            <CopyButton content={copyContent} />
          </div>
        </div>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: TOKENS.animation.duration }}
            >
              {entries.map(([key, value]) => (
                <JsonNode
                  key={key}
                  data={value as JsonValue}
                  keyName={key}
                  level={level + 1}
                  currentDepth={currentDepth + 1}
                  maxOpenDepth={maxOpenDepth}
                  forceExpandState={forceExpandState}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Handle primitives
  let content: React.ReactNode = null;
  let valueColor: string = TOKENS.colors.null;

  switch (typeof data) {
    case "string":
      valueColor = TOKENS.colors.string;
      content = `"${data}"`;
      break;
    case "number":
      valueColor = TOKENS.colors.number;
      content = data.toString();
      break;
    case "boolean":
      valueColor = TOKENS.colors.boolean;
      content = data.toString();
      break;
    case "object":
      if (data === null) {
        valueColor = TOKENS.colors.null;
        content = "null";
      } else if (Array.isArray(data)) {
        content = "[]";
      } else {
        content = "{}";
      }
      break;
    default:
      content = "null";
  }

  return (
    <div
      className="group/line flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors hover:bg-primary/5"
      style={{ marginLeft: level > 0 ? 16 : 0 }}
    >
      <div className="flex-1 font-mono text-xs">
        {keyName && (
          <span style={{ color: TOKENS.colors.key }}>{keyName}: </span>
        )}
        <span style={{ color: valueColor }}>{content}</span>
      </div>
      <CopyButton
        content={copyContent}
        className="opacity-0 transition-opacity group-hover/line:opacity-100"
      />
    </div>
  );
}

// ============================================================================
// JSON VIEWER
// ============================================================================

type JsonViewerProps = {
  data: JsonValue;
  defaultOpenDepth?: number;
  className?: string;
};

export function JsonViewer({
  data,
  defaultOpenDepth = 0,
  className,
}: JsonViewerProps) {
  const [forceExpandState, setForceExpandState] = useState<boolean | null>(
    null
  );

  const shouldShowExpand = useMemo(() => {
    return forceExpandState === null
      ? defaultOpenDepth === 0
      : !forceExpandState;
  }, [forceExpandState, defaultOpenDepth]);

  const toggleForceExpandState = useCallback(() => {
    setForceExpandState(shouldShowExpand);
  }, [shouldShowExpand]);

  return (
    <div
      className={cn("overflow-auto rounded-xl", className)}
      style={{
        background: "color-mix(in srgb, var(--muted) 30%, transparent)",
        border: "1px solid var(--border)",
        padding: 12,
      }}
    >
      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--muted-foreground)" }}
        >
          JSON Data
        </span>
        <motion.button
          type="button"
          onClick={toggleForceExpandState}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-1.5 rounded-md px-2 transition-colors"
          style={{
            height: 24,
            fontSize: 11,
            color: "var(--muted-foreground)",
            background: "color-mix(in srgb, var(--muted) 50%, transparent)",
          }}
        >
          {shouldShowExpand ? (
            <>
              <ChevronsUpDown className="h-3 w-3" />
              Expand All
            </>
          ) : (
            <>
              <ChevronsDownUp className="h-3 w-3" />
              Collapse
            </>
          )}
        </motion.button>
      </div>

      {/* Tree */}
      <JsonNode
        data={data}
        currentDepth={0}
        maxOpenDepth={defaultOpenDepth}
        forceExpandState={forceExpandState}
      />
    </div>
  );
}
