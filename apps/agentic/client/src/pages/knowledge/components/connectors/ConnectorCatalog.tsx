/**
 * ConnectorCatalog — Visual grid of all supported ingestion sources.
 * The current MVP intentionally activates Google Drive + manual ingest only.
 * Other connectors stay visible as roadmap items but are marked coming soon.
 *
 * Categories:
 *   Cloud Storage:  Google Drive, SharePoint/OneDrive, Amazon S3, Azure Blob
 *   Knowledge:      Confluence, Notion, Google Docs
 *   Databases:      PostgreSQL, MySQL, BigQuery, Oracle
 *   Lakehouses:     Snowflake, Databricks, Apache Iceberg
 *   APIs:           REST API, GraphQL, Webhook
 *   Manual:         File Upload, Text Paste, URL Crawl
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardDrive,
  Cloud,
  Database,
  Globe,
  FileText,
  Upload,
  Plug,
  ChevronRight,
  Zap,
  Lock,
  ExternalLink,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@hki/ui";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { k } from "../../theme";

// ── Source Type Registry ─────────────────────────────────────────────────────

export type ConnectorCategory =
  | "cloud_storage"
  | "knowledge_base"
  | "database"
  | "lakehouse"
  | "api"
  | "manual";

export interface SourceTypeDefinition {
  id: string;
  name: string;
  description: string;
  category: ConnectorCategory;
  icon: string; // SVG path or emoji
  color: string; // Tailwind color classes
  bgColor: string; // Icon background
  connectorType?: string; // Maps to DB enum (null = manual mode)
  available: boolean; // false = coming soon
  popular?: boolean;
  featureKey?: FeatureFlagKey;
}

type SourceAvailabilityState =
  | "enabled"
  | "deployment-disabled"
  | "coming-soon";

const CATEGORY_META: Record<
  ConnectorCategory,
  { label: string; icon: LucideIcon; color: string }
> = {
  cloud_storage: {
    label: "Cloud Storage",
    icon: Cloud,
    color: "text-blue-500",
  },
  knowledge_base: {
    label: "Knowledge Domains",
    icon: Globe,
    color: "text-violet-500",
  },
  database: { label: "Databases", icon: Database, color: "text-primary" },
  lakehouse: {
    label: "Data Lakehouses",
    icon: HardDrive,
    color: "text-cyan-500",
  },
  api: { label: "APIs & Webhooks", icon: Plug, color: "text-pink-500" },
  manual: { label: "Manual Input", icon: Upload, color: "text-primary" },
};

export const SOURCE_TYPES: SourceTypeDefinition[] = [
  // ── Cloud Storage ──
  {
    id: "google_drive",
    name: "Google Drive",
    category: "cloud_storage",
    description:
      "Sync folders from Google Drive with automatic change detection",
    icon: "📁",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    connectorType: "google_drive",
    available: true,
    popular: true,
    featureKey: "release.connectors.googleDrive",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    category: "cloud_storage",
    description: "Connect to SharePoint Online document libraries",
    icon: "📋",
    color: "text-[#038387]",
    bgColor: "bg-[#038387]/10",
    connectorType: "sharepoint",
    available: false,
    popular: true,
  },
  {
    id: "s3",
    name: "Amazon S3",
    category: "cloud_storage",
    description: "Pull objects from S3 buckets with prefix filtering",
    icon: "🪣",
    color: "text-[#FF9900]",
    bgColor: "bg-[#FF9900]/10",
    connectorType: "s3",
    available: false,
  },
  {
    id: "azure_blob",
    name: "Azure Blob",
    category: "cloud_storage",
    description: "Connect to Azure Blob Storage containers",
    icon: "☁️",
    color: "text-[#0078D4]",
    bgColor: "bg-[#0078D4]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "gcs",
    name: "Google Cloud Storage",
    category: "cloud_storage",
    description: "Sync from GCS buckets with event-driven triggers",
    icon: "🗄️",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    connectorType: undefined,
    available: false,
  },

  // ── Knowledge Domains ──
  {
    id: "confluence",
    name: "Confluence",
    category: "knowledge_base",
    description: "Import spaces and pages from Atlassian Confluence",
    icon: "📝",
    color: "text-[#0052CC]",
    bgColor: "bg-[#0052CC]/10",
    connectorType: "confluence",
    available: false,
    popular: true,
  },
  {
    id: "notion",
    name: "Notion",
    category: "knowledge_base",
    description: "Sync databases and pages from Notion workspaces",
    icon: "📓",
    color: "text-foreground",
    bgColor: "bg-black/5 dark:bg-muted",
    connectorType: "notion",
    available: false,
  },
  {
    id: "google_docs",
    name: "Google Docs",
    category: "knowledge_base",
    description: "Import documents from Google Workspace",
    icon: "📄",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "gitbook",
    name: "GitBook",
    category: "knowledge_base",
    description: "Sync documentation from GitBook spaces",
    icon: "📖",
    color: "text-[#3884FF]",
    bgColor: "bg-[#3884FF]/10",
    connectorType: undefined,
    available: false,
  },

  // ── Databases ──
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "database",
    description: "Query tables and views from PostgreSQL databases",
    icon: "🐘",
    color: "text-[#336791]",
    bgColor: "bg-[#336791]/10",
    connectorType: undefined,
    available: false,
    popular: true,
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "database",
    description: "Extract data from MySQL tables with custom queries",
    icon: "🐬",
    color: "text-[#4479A1]",
    bgColor: "bg-[#4479A1]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "bigquery",
    name: "BigQuery",
    category: "database",
    description: "Run analytical queries against BigQuery datasets",
    icon: "📊",
    color: "text-[#4285F4]",
    bgColor: "bg-[#4285F4]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "oracle",
    name: "Oracle DB",
    category: "database",
    description: "Connect to Oracle databases for enterprise data extraction",
    icon: "🔴",
    color: "text-[#F80000]",
    bgColor: "bg-[#F80000]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "mssql",
    name: "SQL Server",
    category: "database",
    description: "Extract from Microsoft SQL Server tables and views",
    icon: "🗃️",
    color: "text-[#CC2927]",
    bgColor: "bg-[#CC2927]/10",
    connectorType: undefined,
    available: false,
  },

  // ── Lakehouses ──
  {
    id: "snowflake",
    name: "Snowflake",
    category: "lakehouse",
    description: "Query Snowflake warehouses and external tables",
    icon: "❄️",
    color: "text-[#29B5E8]",
    bgColor: "bg-[#29B5E8]/10",
    connectorType: undefined,
    available: false,
    popular: true,
  },
  {
    id: "databricks",
    name: "Databricks",
    category: "lakehouse",
    description: "Connect to Databricks Unity Catalog tables",
    icon: "🧱",
    color: "text-[#FF3621]",
    bgColor: "bg-[#FF3621]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "iceberg",
    name: "Apache Iceberg",
    category: "lakehouse",
    description: "Read from Iceberg tables via catalog API",
    icon: "🧊",
    color: "text-[#4FC3F7]",
    bgColor: "bg-[#4FC3F7]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "delta_lake",
    name: "Delta Lake",
    category: "lakehouse",
    description: "Read from Delta Lake tables on cloud storage",
    icon: "△",
    color: "text-[#003366]",
    bgColor: "bg-[#003366]/10",
    connectorType: undefined,
    available: false,
  },

  // ── APIs ──
  {
    id: "rest_api",
    name: "REST API",
    category: "api",
    description: "Poll any REST endpoint on a schedule (JSON, XML, CSV)",
    icon: "🔌",
    color: "text-primary",
    bgColor: "bg-primary/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "graphql",
    name: "GraphQL",
    category: "api",
    description: "Query GraphQL endpoints with custom operations",
    icon: "◈",
    color: "text-[#E535AB]",
    bgColor: "bg-[#E535AB]/10",
    connectorType: undefined,
    available: false,
  },
  {
    id: "webhook",
    name: "Webhook",
    category: "api",
    description: "Receive push events via webhook (real-time ingestion)",
    icon: "⚡",
    color: "text-primary",
    bgColor: "bg-primary/10",
    connectorType: undefined,
    available: false,
  },

  // ── Manual ──
  {
    id: "file_upload",
    name: "File Upload",
    category: "manual",
    description: "Upload PDF, DOCX, TXT, CSV, and more",
    icon: "📎",
    color: "text-primary",
    bgColor: "bg-primary/10",
    connectorType: undefined,
    available: true,
    popular: true,
    featureKey: "release.knowledge.ingest.fileUpload",
  },
  {
    id: "text_paste",
    name: "Text Input",
    category: "manual",
    description: "Paste or type text content directly",
    icon: "✏️",
    color: "text-primary",
    bgColor: "bg-primary/10",
    connectorType: undefined,
    available: true,
    featureKey: "release.knowledge.ingest.textPaste",
  },
  {
    id: "url_crawl",
    name: "URL Crawl",
    category: "manual",
    description: "Fetch and extract content from web pages",
    icon: "🌐",
    color: "text-primary",
    bgColor: "bg-primary/10",
    connectorType: undefined,
    available: true,
    featureKey: "release.knowledge.ingest.urlCrawl",
  },
];

// ── Component ────────────────────────────────────────────────────────────────

interface ConnectorCatalogProps {
  onSelectSource: (source: SourceTypeDefinition) => void;
  activeConnectorTypes?: string[];
  enabledFeatureFlags?: Partial<Record<FeatureFlagKey, boolean>>;
}

export default function ConnectorCatalog({
  onSelectSource,
  activeConnectorTypes = [],
  enabledFeatureFlags,
}: ConnectorCatalogProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    ConnectorCategory | "all"
  >("all");

  const categories = Object.keys(CATEGORY_META) as ConnectorCategory[];

  const sourceCards = SOURCE_TYPES.map(source => {
    const availabilityState: SourceAvailabilityState = !source.available
      ? "coming-soon"
      : source.featureKey && enabledFeatureFlags?.[source.featureKey] === false
        ? "deployment-disabled"
        : "enabled";

    return {
      ...source,
      availabilityState,
    };
  });

  const filtered = sourceCards.filter(s => {
    if (selectedCategory !== "all" && s.category !== selectedCategory)
      return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const enabledSourceCount = sourceCards.filter(
    source => source.availabilityState === "enabled"
  );
  const disabledSourceCount = sourceCards.length - enabledSourceCount.length;

  return (
    <div>
      {/* Search + Category filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search connectors..."
            className={cn(k.input, "pl-9 text-sm")}
          />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <button
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
            selectedCategory === "all"
              ? "bg-primary text-white"
              : "bg-muted/60 dark:bg-muted/60 text-muted-foreground dark:text-muted-foreground/60 hover:bg-border dark:hover:bg-white/8"
          )}
        >
          All ({sourceCards.length})
        </button>
        {categories.map(cat => {
          const meta = CATEGORY_META[cat];
          const count = sourceCards.filter(s => s.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors",
                selectedCategory === cat
                  ? "bg-primary text-white"
                  : "bg-muted/60 dark:bg-muted/60 text-muted-foreground dark:text-muted-foreground/60 hover:bg-border dark:hover:bg-white/8"
              )}
            >
              <meta.icon className="w-3.5 h-3.5" />
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {disabledSourceCount > 0 && (
        <p className={cn(k.muted, "mb-4 text-xs")}>
          Some sources are visible but unavailable because they are disabled for
          this deployment or not released yet.
        </p>
      )}

      {/* Connector grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map(source => {
            const isConnected = activeConnectorTypes.includes(source.id);
            const isSelectable = source.availabilityState === "enabled";
            const statusLabel =
              source.availabilityState === "deployment-disabled"
                ? "Disabled"
                : source.availabilityState === "coming-soon"
                  ? "Coming soon"
                  : null;
            const supportingText =
              source.availabilityState === "deployment-disabled"
                ? "Disabled for this deployment"
                : source.availabilityState === "coming-soon"
                  ? "Coming soon"
                  : source.description;

            return (
              <motion.button
                key={source.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                onClick={() => isSelectable && onSelectSource(source)}
                disabled={!isSelectable}
                title={
                  source.availabilityState === "deployment-disabled"
                    ? "Disabled by deployment settings"
                    : undefined
                }
                className={cn(
                  "group relative text-left p-4 rounded-xl border transition-all duration-200",
                  isSelectable
                    ? cn(
                        "border-border/30 dark:border-border/30 bg-card dark:bg-card/90",
                        "kb-duotone-border-hover-strong kb-duotone-shadow-hover",
                        "active:scale-[0.98]"
                      )
                    : "border-dashed border-border/30 dark:border-border/40 bg-muted/40 dark:bg-card/80 opacity-60 cursor-not-allowed"
                )}
              >
                {/* Popular badge */}
                {source.popular && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded bg-primary/10 text-primary">
                    Popular
                  </span>
                )}

                {/* Connected indicator */}
                {isConnected && (
                  <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded kb-duotone-fill">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    Connected
                  </span>
                )}

                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0",
                      source.bgColor
                    )}
                  >
                    {source.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {source.name}
                      </span>
                      {!isSelectable && (
                        <Lock className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-0.5 line-clamp-2 leading-relaxed">
                      {supportingText}
                    </p>
                    {statusLabel && (
                      <span className="mt-2 inline-flex items-center rounded-full border border-border/35 bg-background/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
                        {statusLabel}
                      </span>
                    )}
                  </div>

                  {isSelectable && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-kb-duotone-text-hover transition-colors shrink-0 mt-1" />
                  )}
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground/60">
            No connectors match your search
          </p>
        </div>
      )}
    </div>
  );
}
