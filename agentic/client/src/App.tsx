import { Toaster } from "@/components/ui/sonner";
import {
  TooltipProvider,
  ErrorBoundary,
  NotificationProvider,
  NotificationStream,
  SkipToContent,
  RouteAnnouncer,
} from "@hki/ui";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { ThemeProvider } from "./contexts/ThemeContext";
import AgenticChat from "./pages/AgenticChat";
import EngineeringHub from "./pages/EngineeringHub";
import AgenticPlatformLanding from "./pages/landing";
import { AgenticLoginPage } from "./pages/LoginPage";
import ComponentDemo from "./pages/ComponentDemo";
import UIShowcase from "./pages/UIShowcase";
import AdminLayout from "./pages/admin";
import KnowledgePage from "./pages/knowledge";
import KnowledgeWelcome from "./pages/knowledge/welcome";
import KnowledgeJoin from "./pages/knowledge/join";
import KnowledgeCreate from "./pages/knowledge/create";
import KnowledgeRequestAccess from "./pages/knowledge/request-access";
import { useAuth } from "./_core/hooks/useAuth";
import {
  canAccessKnowledgeWorkspace,
  canManageKnowledgeWorkspace,
} from "./_core/access/knowledge";
import {
  buildChatWorkspaceHref,
  buildKnowledgeWorkspaceHref,
  extractWorkspaceScopeFromSearch,
} from "./_core/workspace-navigation";
import { openBugReport } from "./_core/support";
import { usePermissions } from "./_core/hooks/usePermissions";
import { Bug } from "lucide-react";

import { BrandLoader } from "@/components/ui/brand-loader";

function getAssignedKnowledgeScope(valueStreams: string | null | undefined) {
  return (
    valueStreams
      ?.split(",")
      .map(scope => scope.trim())
      .find(scope => scope && scope !== "global") ?? null
  );
}

// Auth guard component
function ProtectedRoute({
  component: Component,
}: {
  component: React.ComponentType;
}) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return <BrandLoader variant="fullscreen" />;
  }

  if (!user) {
    // Remember where the user wanted to go so we can return after login.
    // Include query string (e.g. ?stream=pharmacy) so multi-tenant context is preserved.
    const fullPath = location + window.location.search;
    sessionStorage.setItem("loginReturnTo", fullPath);
    const isKnowledge = location.startsWith("/knowledge");
    return <Redirect to={isKnowledge ? "/login?from=knowledge" : "/login"} />;
  }

  const returnTo = sessionStorage.getItem("loginReturnTo");
  if (returnTo && location !== returnTo) {
    sessionStorage.removeItem("loginReturnTo");
    return <Redirect to={returnTo} />;
  }
  if (returnTo) {
    sessionStorage.removeItem("loginReturnTo");
  }

  return <Component />;
}

function KnowledgeWorkspaceRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandLoader variant="fullscreen" />;
  }

  if (!user) {
    return <Redirect to="/welcome" />;
  }

  if (!canAccessKnowledgeWorkspace(user.role)) {
    return <Redirect to="/welcome" />;
  }

  return <KnowledgePage />;
}

function KnowledgeCreateRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <BrandLoader variant="fullscreen" />;
  }

  if (!user) {
    return <Redirect to="/login?from=knowledge" />;
  }

  if (!canManageKnowledgeWorkspace(user.role)) {
    return <Redirect to="/knowledge/request-access" />;
  }

  return <KnowledgeCreate />;
}

function AdminWorkspaceRoute() {
  const { user } = useAuth();
  const requestedScope = extractWorkspaceScopeFromSearch(
    window.location.search
  );

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (user.role !== "admin") {
    const redirectScope =
      requestedScope ?? getAssignedKnowledgeScope(user.valueStreams);

    return (
      <Redirect
        to={
          canAccessKnowledgeWorkspace(user.role)
            ? buildKnowledgeWorkspaceHref(redirectScope)
            : buildChatWorkspaceHref(redirectScope)
        }
      />
    );
  }

  return <AdminLayout />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={AgenticPlatformLanding} />
      <Route path="/engineering" component={EngineeringHub} />
      <Route path="/login" component={AgenticLoginPage} />
      <Route path="/demo" component={ComponentDemo} />
      <Route path="/ui-showcase" component={UIShowcase} />
      <Route path="/welcome" component={KnowledgeWelcome} />
      <Route path="/knowledge/welcome">
        {() => <Redirect to="/welcome" />}
      </Route>
      <Route path="/knowledge/join" component={KnowledgeJoin} />
      <Route
        path="/knowledge/request-access"
        component={KnowledgeRequestAccess}
      />
      <Route path="/knowledge/create">
        {() => <ProtectedRoute component={KnowledgeCreateRoute} />}
      </Route>

      {/* Protected routes */}
      <Route path="/chat">
        {() => <ProtectedRoute component={AgenticChat} />}
      </Route>
      <Route path="/admin/*?">
        {() => <ProtectedRoute component={AdminWorkspaceRoute} />}
      </Route>
      <Route path="/knowledge" component={KnowledgeWorkspaceRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function RouteAnnouncerBridge() {
  const [location] = useLocation();
  const title =
    location === "/"
      ? "HKI Agentic — Enterprise AI Platform"
      : location === "/engineering"
        ? "Innovation Engineering"
        : location
            .replace(/^\//, "")
            .replace(/\//g, " › ")
            .replace(/-/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
  return <RouteAnnouncer title={`Navigated to ${title}`} />;
}

function GlobalReportBugFallback() {
  const [location] = useLocation();
  const { role } = usePermissions();
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : location;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const hasStreamWorkspaceShell =
    pathname === "/knowledge" && search.includes("stream=");
  const hasDedicatedSupportAction =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/chat") ||
    hasStreamWorkspaceShell;

  if (hasDedicatedSupportAction) return null;

  const area =
    pathname.startsWith("/knowledge") || pathname === "/welcome"
      ? "Knowledge Base"
      : pathname.startsWith("/engineering")
        ? "Engineering Hub"
        : pathname.startsWith("/login")
          ? "Login"
          : "Agentic Platform";

  return (
    <button
      type="button"
      onClick={() =>
        openBugReport({
          area,
          role,
          path: `${pathname}${search}`,
        })
      }
      className="fixed bottom-4 right-4 z-50 inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/25 bg-background/95 px-3 text-xs font-semibold text-destructive shadow-lg ring-1 ring-border/60 backdrop-blur transition-colors hover:bg-destructive/10"
      aria-label="Report Bug"
    >
      <Bug className="h-4 w-4" />
      Report Bug
    </button>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <NotificationProvider>
          <TooltipProvider>
            <SkipToContent />
            <Toaster />
            <NotificationStream />
            <RouteAnnouncerBridge />
            <Router />
            <GlobalReportBugFallback />
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
