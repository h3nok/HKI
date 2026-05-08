import { Settings, LogOut, LifeBuoy } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { openBugReport } from "@/_core/support";
import { FONT_FAMILY } from "@hki/ui";

export interface UserFooterProps {
  onOpenSettings: () => void;
  isScopeLocked?: boolean;
  /** WebSocket connection status — undefined = no active task (neutral), true = connected, false = reconnecting */
  isConnected?: boolean;
}

export function UserFooter({
  onOpenSettings,
  isScopeLocked = false,
  isConnected,
}: UserFooterProps) {
  const { user, logout } = useAuth();
  const { role } = usePermissions();

  const getInitials = () => {
    if (user?.name)
      return user.name
        .split(" ")
        .map(n => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return "U";
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "User";

  const handleLogout = async () => {
    try {
      await logout();
      window.location.replace("/login");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const handleReportBug = () =>
    openBugReport({
      area: "Agent Chat",
      role,
    });

  return (
    <div
      className="agentic-sidebar-footer mt-auto px-3 py-2"
      style={{
        borderTop:
          "1px solid color-mix(in srgb, var(--sidebar-border) 40%, transparent)",
      }}
    >
      {/* System health status */}
      <div
        className="flex items-center gap-1.5 px-1 mb-2"
        style={{
          fontFamily: FONT_FAMILY.mono,
          fontSize: 10,
          letterSpacing: "0.04em",
        }}
      >
        {isConnected === false ? (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
            <span className="text-destructive/70">Reconnecting…</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sidebar-muted-foreground/60">
              {isConnected === true ? "Connected" : "Ready"}
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={handleReportBug}
        className="agentic-sidebar-support-button mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2 text-xs font-semibold text-sidebar-muted-foreground transition-colors hover:border-primary/25 hover:bg-primary/8 hover:text-sidebar-foreground"
      >
        <LifeBuoy className="h-3.5 w-3.5" />
        Support
      </button>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="agentic-sidebar-avatar w-8 h-8 rounded-lg flex items-center justify-center text-white font-semibold shrink-0"
            style={{ fontSize: 11, background: "var(--sidebar-primary)" }}
          >
            {getInitials()}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-sidebar-foreground truncate">
              {displayName}
            </div>
            {user?.email && (
              <div
                className="text-[10px] text-sidebar-muted-foreground truncate"
                style={{ opacity: 0.6 }}
              >
                {user.email}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onOpenSettings}
                className="agentic-sidebar-footer-icon p-1.5 rounded-md text-sidebar-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className="agentic-sidebar-footer-icon p-1.5 rounded-md text-sidebar-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Sign out</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
