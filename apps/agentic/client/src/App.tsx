import { Toaster } from "@/components/ui/sonner";
import {
  TooltipProvider,
  ErrorBoundary,
  NotificationProvider,
  NotificationStream,
  SkipToContent,
  RouteAnnouncer,
} from "@hki/ui";
import { Route, Switch, Redirect, useLocation } from "wouter";
import { lazy, Suspense, type ReactNode } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
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
import { LifeBuoy } from "lucide-react";
import {
  ENGINEERING_HUB_ROUTE,
  HKI_STANDARD_ROUTE,
} from "./pages/engineering/constants";

import { BrandLoader } from "@/components/ui/brand-loader";

const AdminLayout = lazy(() => import("./pages/admin"));
const AgenticChat = lazy(() => import("./pages/AgenticChat"));
const AgenticLoginPage = lazy(() => import("./pages/LoginPage"));
const AgenticPlatformLanding = lazy(() => import("./pages/landing"));
const ComponentDemo = lazy(() => import("./pages/ComponentDemo"));
const EngineeringHub = lazy(() => import("./pages/EngineeringHub"));
const EngineeringStandardPage = lazy(
  () => import("./pages/EngineeringStandardPage")
);
const KnowledgeCreate = lazy(() => import("./pages/knowledge/create"));
const KnowledgeJoin = lazy(() => import("./pages/knowledge/join"));
const KnowledgePage = lazy(() => import("./pages/knowledge"));
const KnowledgeRequestAccess = lazy(
  () => import("./pages/knowledge/request-access")
);
const KnowledgeWelcome = lazy(() => import("./pages/knowledge/welcome"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const UIShowcase = lazy(() => import("./pages/UIShowcase"));

function getAssignedKnowledgeScope(valueStreams: string | null | undefined) {
  return (
    valueStreams
      ?.split(",")
      .map(scope => scope.trim())
      .find(scope => scope && scope !== "global") ?? null
  );
}

// Auth guard component
function ProtectedRoute({ children }: { children: ReactNode }) {
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

  return <>{children}</>;
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
    <Suspense fallback={<BrandLoader variant="fullscreen" />}>
      <Switch>
        {/* Public routes */}
        <Route path="/">{() => <AgenticPlatformLanding />}</Route>
        <Route path={HKI_STANDARD_ROUTE}>
          {() => <EngineeringStandardPage />}
        </Route>
        <Route path={ENGINEERING_HUB_ROUTE}>{() => <EngineeringHub />}</Route>
        <Route path="/login">{() => <AgenticLoginPage />}</Route>
        <Route path="/demo">{() => <ComponentDemo />}</Route>
        <Route path="/ui-showcase">{() => <UIShowcase />}</Route>
        <Route path="/welcome">{() => <KnowledgeWelcome />}</Route>
        <Route path="/knowledge/welcome">
          {() => <Redirect to="/welcome" />}
        </Route>
        <Route path="/knowledge/join">{() => <KnowledgeJoin />}</Route>
        <Route path="/knowledge/request-access">
          {() => <KnowledgeRequestAccess />}
        </Route>
        <Route path="/knowledge/create">
          {() => (
            <ProtectedRoute>
              <KnowledgeCreateRoute />
            </ProtectedRoute>
          )}
        </Route>

        {/* Protected routes */}
        <Route path="/chat">
          {() => (
            <ProtectedRoute>
              <AgenticChat />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/admin/*?">
          {() => (
            <ProtectedRoute>
              <AdminWorkspaceRoute />
            </ProtectedRoute>
          )}
        </Route>
        <Route path="/knowledge">{() => <KnowledgeWorkspaceRoute />}</Route>
        <Route>{() => <NotFound />}</Route>
      </Switch>
    </Suspense>
  );
}

function RouteAnnouncerBridge() {
  const [location] = useLocation();
  const title =
    location === "/"
      ? "HKI — Hermetic Knowledge Isolation"
      : location === HKI_STANDARD_ROUTE
        ? "HKI Standard Architecture"
        : location === ENGINEERING_HUB_ROUTE
          ? "HKI Engineering Standard"
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
  const isPublicStandardRoute =
    pathname === "/" ||
    pathname.startsWith("/engineering") ||
    pathname.startsWith("/login");

  if (hasDedicatedSupportAction || isPublicStandardRoute) return null;

  const area =
    pathname.startsWith("/knowledge") || pathname === "/welcome"
      ? "Knowledge Domains"
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
      className="fixed bottom-4 right-4 z-50 inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card/95 px-3 text-xs font-semibold text-muted-foreground shadow-lg ring-1 ring-border/50 backdrop-blur transition-colors hover:border-primary/25 hover:bg-primary/8 hover:text-foreground"
      aria-label="Open support"
    >
      <LifeBuoy className="h-4 w-4" />
      Support
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
