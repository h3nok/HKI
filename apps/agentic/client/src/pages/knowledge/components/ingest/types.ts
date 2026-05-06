/**
 * Ingest Pipeline — Shared types and constants
 */

import type { LucideIcon } from "lucide-react";
import {
  Upload,
  FileText,
  Globe,
  File,
  ShieldCheck,
  Eye,
  Gavel,
  Database,
} from "lucide-react";
import type { DocumentClassification } from "@shared/knowledge-types";
import type { IngestMode } from "../../types";

// ── Pipeline stage status ────────────────────────────────────────────────────

export type StageStatus = "idle" | "active" | "done" | "rejected";

export interface StageInfo {
  key: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  activeLabel: string;
}

export const STAGES: StageInfo[] = [
  {
    key: "validate",
    icon: ShieldCheck,
    label: "Validate",
    desc: "Quality, completeness, sensitive data check",
    activeLabel: "Validating…",
  },
  {
    key: "interpret",
    icon: Eye,
    label: "Interpret",
    desc: "Type, department, tags, entities",
    activeLabel: "Interpreting…",
  },
  {
    key: "decide",
    icon: Gavel,
    label: "Decide",
    desc: "Relevance gate + duplicate check",
    activeLabel: "Evaluating…",
  },
  {
    key: "ingest",
    icon: Database,
    label: "Ingest",
    desc: "Chunk, embed, index into vector store",
    activeLabel: "Indexing…",
  },
];

// ── Input mode tabs ──────────────────────────────────────────────────────────

export interface ModeTab {
  key: IngestMode;
  icon: typeof File;
  label: string;
}

export const MODES: ModeTab[] = [
  { key: "file", icon: Upload, label: "Files" },
  { key: "text", icon: FileText, label: "Text" },
  { key: "url", icon: Globe, label: "URL" },
];

// ── Source connectors ────────────────────────────────────────────────────────

export interface ConnectorInfo {
  key: string;
  label: string;
  desc: string;
  available: boolean;
}

export const CONNECTORS: ConnectorInfo[] = [
  {
    key: "google_drive",
    label: "Google Drive",
    desc: "Sync shared folders",
    available: true,
  },
  {
    key: "sharepoint",
    label: "SharePoint",
    desc: "Microsoft 365",
    available: false,
  },
  {
    key: "confluence",
    label: "Confluence",
    desc: "Atlassian wiki",
    available: false,
  },
];

// ── Framer motion presets ────────────────────────────────────────────────────

export const stagger = { animate: { transition: { staggerChildren: 0.05 } } };
export const child = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

// ── Form state ───────────────────────────────────────────────────────────────

export interface IngestFormState {
  content: string;
  url: string;
  title: string;
  department: string;
  documentType: string;
  tags: string;
  classification: DocumentClassification;
  allowedGroups: string;
  deniedGroups: string;
}
