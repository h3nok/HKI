"use client";

/**
 * LoginPage - Enterprise Authentication Component
 *
 * Deployment Best Practices:
 * - Platform-agnostic with customizable branding
 * - Supports multiple auth providers (SSO, OAuth, SAML)
 * - Environment-aware (dev bypass, production OAuth)
 * - Responsive design with mobile-first approach
 * - Accessible (WCAG 2.1 AA compliant)
 * - Security-focused (CSRF protection ready, secure redirects)
 */

import * as React from "react";
import { cn } from "../utils";

// ============================================================================
// Types
// ============================================================================

export type AuthProviderType =
  | "sso"
  | "google"
  | "azure"
  | "okta"
  | "saml"
  | "dev";

export interface AuthProvider {
  id: string;
  type: AuthProviderType;
  name: string;
  href: string;
  icon?: React.ReactNode;
  primary?: boolean;
  description?: string;
  disabled?: boolean;
}

export interface PlatformBranding {
  /** Platform name (e.g., "Agentic", "Hub") */
  name: string;
  /** Platform tagline */
  tagline?: string;
  /** Logo component or image */
  logo?: React.ReactNode;
  /** Icon component for mobile/compact views */
  icon?: React.ReactNode;
  /** Primary brand color (hex) */
  primaryColor?: string;
  /** Secondary/accent color (hex) */
  accentColor?: string;
  /** Hero background style */
  heroStyle?: "gradient" | "image" | "minimal";
  /** Custom hero background */
  heroBackground?: string;
}

export interface LoginPageProps {
  /** Platform-specific branding */
  branding: PlatformBranding;
  /** Authentication providers to display */
  providers: AuthProvider[];
  /** Page title */
  title?: string;
  /** Subtitle/description */
  subtitle?: string;
  /** Hero panel title (supports React nodes for styling) */
  heroTitle?: React.ReactNode;
  /** Hero panel description */
  heroDescription?: string;
  /** Feature pills to display in hero */
  features?: string[];
  /** Loading state */
  isLoading?: boolean;
  /** Security badge text */
  securityBadge?: string;
  /** Footer links */
  footerLinks?: Array<{ label: string; href: string }>;
  /** Copyright text */
  copyright?: string;
  /** Additional content below providers */
  children?: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Callback when auth is initiated */
  onAuthStart?: (provider: AuthProvider) => void;
  /** Environment indicator */
  environment?: "development" | "staging" | "production";
}

// ============================================================================
// Default Values
// ============================================================================

const defaultFooterLinks = [
  { label: "Help", href: "#help" },
  { label: "Support", href: "#support" },
  { label: "Privacy", href: "#privacy" },
];

// ============================================================================
// Sub-components
// ============================================================================

function LoadingState({ branding }: { branding: PlatformBranding }) {
  const primaryColor = branding.primaryColor || "#0E7C7B";

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          {branding.icon || (
            <div
              className="w-16 h-16 rounded-2xl"
              style={{ backgroundColor: primaryColor }}
            />
          )}
          <div className="absolute inset-0 -m-4">
            <div
              className="absolute inset-0 border-2 rounded-3xl animate-ping"
              style={{ borderColor: `${primaryColor}33` }}
            />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-gray-600">Authenticating...</p>
          <div className="flex gap-1 justify-center">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{
                  backgroundColor: primaryColor,
                  animationDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroPanel({
  branding,
  heroTitle,
  heroDescription,
  features,
  copyright,
}: {
  branding: PlatformBranding;
  heroTitle?: React.ReactNode;
  heroDescription?: string | undefined;
  features?: string[] | undefined;
  copyright?: string | undefined;
}) {
  const primaryColor = branding.primaryColor || "#0E7C7B";
  const accentColor = branding.accentColor || primaryColor;

  return (
    <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background: primaryColor,
          }}
        />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full blur-3xl animate-pulse"
          style={{
            background: `${accentColor}26`,
            animationDuration: "4s",
          }}
        />
        <div
          className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse"
          style={{
            background: "rgba(255,255,255,0.08)",
            animationDuration: "6s",
            animationDelay: "2s",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "none",
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between w-full p-16">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-2xl shadow-black/10">
            {branding.logo || (
              <div
                className="text-xl font-bold"
                style={{ color: primaryColor }}
              >
                {branding.name}
              </div>
            )}
          </div>
        </div>

        {/* Hero content */}
        <div className="flex flex-col items-start max-w-xl">
          <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
            {heroTitle || branding.name}
          </h1>
          <p className="text-white/60 text-lg xl:text-xl max-w-md leading-relaxed mb-10">
            {heroDescription ||
              branding.tagline ||
              `Welcome to ${branding.name}`}
          </p>

          {features && features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {features.map(feature => (
                <div
                  key={feature}
                  className="px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/70 text-sm font-medium border border-white/10"
                >
                  {feature}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-white/30 text-sm">
            {copyright || `© ${new Date().getFullYear()} HKI`}
          </span>
          <div className="flex items-center gap-2 text-white/30">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="text-sm">Secure Access</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthButton({
  provider,
  primaryColor,
  onAuthStart,
}: {
  provider: AuthProvider;
  primaryColor: string;
  onAuthStart?: ((provider: AuthProvider) => void) | undefined;
}) {
  const handleClick = (e: React.MouseEvent) => {
    if (provider.disabled) {
      e.preventDefault();
      return;
    }
    onAuthStart?.(provider);
  };

  if (provider.primary) {
    return (
      <a
        href={provider.disabled ? "#" : provider.href}
        onClick={handleClick}
        className={cn(
          "w-full h-14 rounded-2xl font-medium text-base text-white",
          "flex items-center justify-center gap-3",
          "shadow-lg transition-all duration-300",
          "hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
          provider.disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{
          background: primaryColor,
          boxShadow: `0 10px 25px -5px ${primaryColor}40`,
        }}
      >
        {provider.icon}
        <span>{provider.name}</span>
        <svg
          className="w-5 h-5 ml-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 8l4 4m0 0l-4 4m4-4H3"
          />
        </svg>
      </a>
    );
  }

  return (
    <a
      href={provider.disabled ? "#" : provider.href}
      onClick={handleClick}
      className={cn(
        "w-full h-12 rounded-xl font-medium",
        "flex items-center justify-center gap-3",
        "border border-gray-200 bg-white",
        "hover:bg-gray-50 hover:border-gray-300",
        "transition-all duration-200 text-gray-700",
        provider.disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {provider.icon}
      <span>{provider.name}</span>
    </a>
  );
}

function LoginForm({
  branding,
  title,
  subtitle,
  providers,
  securityBadge,
  footerLinks,
  copyright,
  children,
  onAuthStart,
  environment,
}: {
  branding: PlatformBranding;
  title?: string | undefined;
  subtitle?: string | undefined;
  providers: AuthProvider[];
  securityBadge?: string | undefined;
  footerLinks?: Array<{ label: string; href: string }> | undefined;
  copyright?: string | undefined;
  children?: React.ReactNode;
  onAuthStart?: ((provider: AuthProvider) => void) | undefined;
  environment?: "development" | "staging" | "production" | undefined;
}) {
  const primaryColor = branding.primaryColor || "#0E7C7B";
  const links = footerLinks || defaultFooterLinks;

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Mobile header */}
      <header className="lg:hidden p-6 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-4">
          {branding.icon}
          <div>
            <h2 className="font-semibold text-gray-900">{branding.name}</h2>
            {branding.tagline && (
              <p className="text-xs text-gray-500">{branding.tagline}</p>
            )}
          </div>
        </div>
      </header>

      {/* Environment banner */}
      {environment && environment !== "production" && (
        <div
          className={cn(
            "text-center text-xs py-1 font-medium",
            environment === "development" && "bg-yellow-100 text-yellow-800",
            environment === "staging" && "bg-blue-100 text-blue-800"
          )}
        >
          {environment.toUpperCase()} ENVIRONMENT
        </div>
      )}

      {/* Login content */}
      <main className="flex-1 flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-sm">
          {/* Desktop logo */}
          <div className="hidden lg:flex justify-center mb-12">
            <div className="relative">
              {branding.logo || (
                <div
                  className="text-2xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {branding.name}
                </div>
              )}
            </div>
          </div>

          {/* Welcome header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">
              {title || "Welcome back"}
            </h1>
            <p className="text-gray-500 text-base">
              {subtitle || `Sign in to continue to ${branding.name}`}
            </p>
          </div>

          {/* Login card */}
          <div className="bg-white rounded-2xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
            <div className="space-y-4">
              {providers.map((provider, index) => (
                <div key={provider.id}>
                  <AuthButton
                    provider={provider}
                    primaryColor={primaryColor}
                    onAuthStart={onAuthStart}
                  />
                  {provider.description && (
                    <p className="text-center text-xs text-gray-400 mt-2">
                      {provider.description}
                    </p>
                  )}
                  {index < providers.length - 1 && providers.length > 1 && (
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-xs text-gray-400">
                          or
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Security badge */}
            <div className="flex items-center justify-center gap-2 mt-6 pt-6 border-t border-gray-100">
              <svg
                className="w-4 h-4 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                />
              </svg>
              <span className="text-xs text-gray-500">
                {securityBadge || "Secured by HKI IT"}
              </span>
            </div>

            {children}
          </div>

          {/* Footer links */}
          <div className="mt-8 flex items-center justify-center gap-6 text-sm">
            {links.map((link, index) => (
              <div key={link.label} className="flex items-center gap-6">
                {index > 0 && <span className="text-gray-200">•</span>}
                <a
                  href={link.href}
                  className="hover:underline transition-colors"
                  style={{ color: primaryColor }}
                >
                  {link.label}
                </a>
              </div>
            ))}
          </div>

          {/* Mobile copyright */}
          <p className="lg:hidden text-center text-xs text-gray-400 mt-10">
            {copyright || `© ${new Date().getFullYear()} HKI`}
          </p>
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LoginPage({
  branding,
  providers,
  title,
  subtitle,
  heroTitle,
  heroDescription,
  features,
  isLoading = false,
  securityBadge,
  footerLinks,
  copyright,
  children,
  className,
  onAuthStart,
  environment,
}: LoginPageProps) {
  if (isLoading) {
    return <LoadingState branding={branding} />;
  }

  return (
    <div className={cn("min-h-screen bg-gray-50", className)}>
      <div className="min-h-screen flex">
        <HeroPanel
          branding={branding}
          heroTitle={heroTitle}
          heroDescription={heroDescription}
          features={features}
          copyright={copyright}
        />
        <LoginForm
          branding={branding}
          title={title}
          subtitle={subtitle}
          providers={providers}
          securityBadge={securityBadge}
          footerLinks={footerLinks}
          copyright={copyright}
          onAuthStart={onAuthStart}
          environment={environment}
        >
          {children}
        </LoginForm>
      </div>
    </div>
  );
}

// ============================================================================
// Platform Presets - Deployment Ready Configurations
// ============================================================================

export const PLATFORM_PRESETS = {
  agentic: {
    name: "Agentic AI",
    tagline: "Enterprise AI Assistant",
    primaryColor: "#0E7C7B",
    accentColor: "#0E7C7B",
  },
  hub: {
    name: "HKIs",
    tagline: "Technology Innovation Hub",
    primaryColor: "#0E7C7B",
    accentColor: "#0E7C7B",
  },
} as const;

export const AUTH_PROVIDER_PRESETS = {
  hkiSSO: (href = "/api/auth/sso"): AuthProvider => ({
    id: "hki-sso",
    type: "sso",
    name: "Sign in with HKI SSO",
    href,
    primary: true,
    description: "Corporate single sign-on",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  }),
  googleWorkspace: (href = "/api/auth/google"): AuthProvider => ({
    id: "google",
    type: "google",
    name: "Sign in with Google",
    href,
    description: "Google Workspace account",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
  }),
  devBypass: (href = "/api/dev-login"): AuthProvider => ({
    id: "dev",
    type: "dev",
    name: "Development Login",
    href,
    description: "Skip auth for development",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
  }),
} as const;

export default LoginPage;
