/**
 * Knowledge Breadcrumb Bar — Top bar with breadcrumbs, theme toggle,
 * playbook button, notification center, and API docs link.
 *
 * Extracted from index.tsx for single-responsibility modularity.
 */

import {
  BookOpen,
  BadgeCheck,
  Moon,
  Sun,
  Building2,
  Globe,
} from "lucide-react";
import { cn, NotificationCenter } from "@hki/ui";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { canManageKnowledgeWorkspace } from "@/_core/access/knowledge";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { BreadcrumbBar } from "@/components/ui/breadcrumb-bar";
import { useTheme } from "@/contexts/ThemeContext";
import { buildChatWorkspaceHref } from "@/_core/workspace-navigation";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { OpsIcon } from "@/components/ui/icons/OpsIcon";
import type { KnowledgeTab } from "../types";
import { useKB } from "../context/KnowledgeContext";
import ServiceHealthIndicator from "../components/ServiceHealthIndicator";
import { streamColorToken } from "../theme";

interface KnowledgeBreadcrumbProps {
  tab: KnowledgeTab;
  setTab: (t: KnowledgeTab) => void;
  groupLabel: string;
  groupFirstTab: KnowledgeTab;
  metaTitle: string;
  metaDesc?: string;
  selectedStream: string;
  streamLabel: string;
}

export default function KnowledgeBreadcrumb({
  tab,
  setTab,
  groupLabel,
  groupFirstTab,
  metaTitle,
  metaDesc,
  selectedStream,
  streamLabel,
}: KnowledgeBreadcrumbProps) {
  const { theme, toggleTheme } = useTheme();
  const { role } = usePermissions();
  const { onOpenGuide, isAttested, attestedAt } = useKB();
  const canManageKnowledge = canManageKnowledgeWorkspace(role);
  const canAccessAdmin = role === "admin";
  const chatHref = buildChatWorkspaceHref(selectedStream);

  const streamColor = streamColorToken(selectedStream);
  const streamLabel_ = selectedStream ? streamLabel : "Coworker Agent";

  return (
    <BreadcrumbBar
      className="kb-page-header"
      segments={[
        // Home — always clickable back to overview
        ...(tab !== "overview"
          ? [
              {
                label: "Knowledge",
                hideOnMobile: true,
                onClick: () => setTab("overview" as KnowledgeTab),
              },
            ]
          : []),
        // Current page title
        { label: metaTitle },
        // Stream pill
        {
          label: streamLabel_,
          icon: selectedStream ? Building2 : Globe,
          iconClassName: streamColor.text,
          hideOnMobile: true,
          className: cn(
            "rounded-full px-2.5 py-0.5 ring-1",
            streamColor.text,
            streamColor.bg,
            streamColor.ring
          ),
        },
        // Contextual description
        ...(metaDesc
          ? [
              {
                label: metaDesc,
                hideOnMobile: true,
                className: "text-muted-foreground/60 font-normal text-xs",
              },
            ]
          : []),
      ]}
      trailing={
        <div className="flex items-center gap-1.5">
          <nav
            className="flex items-center gap-0.5"
            aria-label="Platform navigation"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={chatHref}
                  className="platform-nav-link inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label="Agentic Chat"
                >
                  <AgenticIcon size={14} className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Chat</span>
                </a>
              </TooltipTrigger>
              <TooltipContent side="bottom">Open Agentic Chat</TooltipContent>
            </Tooltip>
            {canAccessAdmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="/admin"
                    className="platform-nav-link inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    aria-label="Enterprise Admin Hub"
                  >
                    <OpsIcon size={14} className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Admin</span>
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open Admin Hub</TooltipContent>
              </Tooltip>
            )}
          </nav>
          <div
            className="h-4 w-px mx-0.5"
            style={{
              background: "color-mix(in srgb, var(--border) 60%, transparent)",
            }}
          />
          <ServiceHealthIndicator />
          {canManageKnowledge && (
            <button
              onClick={onOpenGuide}
              aria-label={
                isAttested
                  ? "Open the playbook again"
                  : "Open the required playbook"
              }
              className={cn(
                "dashboard-toolbar-button inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isAttested
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-foreground/72 hover:text-foreground"
              )}
              title={
                isAttested && attestedAt
                  ? `Attested on ${new Date(attestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  : "Agent Success Playbook — Required Reading"
              }
            >
              {isAttested ? (
                <BadgeCheck className="w-3.5 h-3.5" />
              ) : (
                <BookOpen className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {isAttested ? "View Playbook" : "Read Playbook"}
              </span>
            </button>
          )}
          <NotificationCenter />
          <button
            onClick={toggleTheme}
            className={cn(
              "dashboard-toolbar-button dashboard-toolbar-button--icon inline-flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground"
            )}
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="w-3.5 h-3.5" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      }
    />
  );
}
