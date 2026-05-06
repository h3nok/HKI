import { type ReactNode, useEffect } from "react";
import { ArrowLeft, LogIn, Moon, Sun } from "lucide-react";
import { Button, cn } from "@hki/ui";
import { useLocation } from "wouter";

import { useAuth } from "@/_core/hooks/useAuth";
import { AgenticIcon } from "@/components/ui/icons/AgenticIcon";
import { useTheme } from "@/contexts/ThemeContext";

interface SelfServiceBackLink {
  href: string;
  label: string;
}

interface KnowledgeSelfServiceShellProps {
  back?: SelfServiceBackLink;
  children: ReactNode;
  className?: string;
  showSignIn?: boolean;
}

export function useKnowledgePageMeta(title: string) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const prevHref = link?.href;
    const prevTitle = document.title;
    if (link) link.href = "/favicon-knowledge.svg";
    document.title = title;
    return () => {
      if (link && prevHref) link.href = prevHref;
      document.title = prevTitle;
    };
  }, [title]);
}

export function KnowledgeSelfServiceShell({
  back,
  children,
  className,
  showSignIn = true,
}: KnowledgeSelfServiceShellProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  const navigate = (href: string) => setLocation(href);

  return (
    <div
      className={cn(
        "kb-self-service-shell flex min-h-screen flex-col text-foreground",
        className
      )}
    >
      <header className="kb-self-service-nav">
        <div className="flex min-w-0 flex-1 items-center">
          {back ? (
            <a
              href={back.href}
              onClick={event => {
                event.preventDefault();
                navigate(back.href);
              }}
              className="kb-self-service-back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {back.label}
            </a>
          ) : (
            <BrandLink onNavigate={navigate} />
          )}
        </div>

        {back ? (
          <div className="hidden flex-1 justify-center sm:flex">
            <BrandLink onNavigate={navigate} />
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-end gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="kb-self-service-icon-button"
            title={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          {showSignIn && !user ? (
            <Button
              type="button"
              onClick={() => navigate("/login?from=knowledge")}
              variant="outline"
              className="gap-1.5 rounded-lg px-4 text-xs font-medium"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </Button>
          ) : null}
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col px-5 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="kb-self-service-footer">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Hermetic</span>
          <span className="mx-2 text-muted-foreground/45">/</span>
          Innovation & Technology
        </p>
        <a
          href="/"
          onClick={event => {
            event.preventDefault();
            navigate("/");
          }}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Agentic Platform
        </a>
      </footer>
    </div>
  );
}

function BrandLink({ onNavigate }: { onNavigate: (href: string) => void }) {
  return (
    <a
      href="/"
      onClick={event => {
        event.preventDefault();
        onNavigate("/");
      }}
      className="kb-self-service-brand"
    >
      <AgenticIcon size={22} className="text-primary" />
      <span>
        <span className="font-semibold text-foreground">Hermetic</span>{" "}
        <span className="text-muted-foreground">Agentic</span>
      </span>
    </a>
  );
}
