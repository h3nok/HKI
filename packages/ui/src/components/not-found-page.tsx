/**
 * NotFoundPage — Shared 404 page component.
 * Uses semantic design tokens for full light/dark mode support.
 */

import { AlertCircle, Home } from "lucide-react";

import { Button } from "./button";
import { Card, CardContent } from "./card";
import { cn } from "../utils";

export interface NotFoundPageProps {
  /** Callback when the user clicks "Go Home". */
  onGoHome: () => void;
  /** Optional class applied to the root container. */
  className?: string;
}

export function NotFoundPage({ onGoHome, className }: NotFoundPageProps) {
  return (
    <div
      className={cn(
        "min-h-screen w-full flex items-center justify-center bg-background text-foreground",
        className
      )}
    >
      <Card className="w-full max-w-lg mx-4 shadow-lg border bg-card/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/10 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-destructive" />
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-2">404</h1>

          <h2 className="text-xl font-semibold mb-4">Page Not Found</h2>

          <p className="text-muted-foreground mb-8 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={onGoHome}
              className="bg-[#0066B2] hover:bg-[#00528E] text-white px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
