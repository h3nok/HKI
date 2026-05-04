/**
 * PlatformNav — Shared top navigation for non-chat Agentic pages.
 *
 * Provides navigation between Chat, Knowledge, Observability, and
 * Admin. Also includes a theme toggle and a quick return path to chat.
 */

import { useLocation } from "wouter";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { canAccessKnowledgeWorkspace } from "@/_core/access/knowledge";
import { hasPlatformAdminAccess } from "@shared/access-control";
import { useTheme } from "@/contexts/ThemeContext";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import {
  MessageSquare,
  BookOpen,
  Shield,
  Sun,
  Moon,
  ArrowLeft,
  BarChart3,
} from "lucide-react";

const OBSERVABILITY_URL =
  import.meta.env.VITE_OBSERVABILITY_URL ||
  "https://console.cloud.google.com/monitoring/dashboards?project=p-642-cilab-gke";

export function PlatformNav() {
  const [location] = useLocation();
  const { role } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const knowledgeHref = canAccessKnowledgeWorkspace(role)
    ? "/knowledge"
    : "/welcome";
  const navItems = [
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: knowledgeHref, label: "Knowledge", icon: BookOpen },
    {
      href: OBSERVABILITY_URL,
      label: "Observability",
      icon: BarChart3,
      external: true,
    },
    ...(hasPlatformAdminAccess(role)
      ? [{ href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 flex items-center h-14 gap-6">
        {/* Brand */}
        <a
          href="/"
          className="flex items-center gap-2.5 shrink-0 hover:opacity-80 transition-opacity"
        >
          <AgenticIcon size={24} />
          <span className="text-sm font-bold tracking-wide">
            <span className="text-primary">COSTCO</span>{" "}
            <span className="text-secondary">AGENTIC</span>
          </span>
        </a>

        {/* Separator */}
        <div className="h-6 w-px bg-border/60 shrink-0" />

        {/* Nav links */}
        <nav
          className="flex items-center gap-1 flex-1"
          aria-label="Platform navigation"
        >
          {navItems.map(({ href, label, icon: Icon, external }) => {
            const isActive =
              !external &&
              (location === href || location.startsWith(href + "/"));
            return (
              <a
                key={href}
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden md:inline">{label}</span>
              </a>
            );
          })}
        </nav>

        {/* Right side: theme toggle + back to chat */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4" />
            )}
          </button>
          <a
            href="/chat"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                       bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Chat</span>
          </a>
        </div>
      </div>
    </header>
  );
}
