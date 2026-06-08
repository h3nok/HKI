import React, { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button, Badge, Separator } from "@hki/ui";

// Myelin logo — axon with two myelin sheath segments
function MyelinMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden>
      {/* Axon */}
      <line
        x1="3"
        y1="14"
        x2="25"
        y2="14"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.2"
      />
      {/* Left sheath (violet) */}
      <ellipse
        cx="9.5"
        cy="14"
        rx="5"
        ry="3.5"
        stroke="#8b36d6"
        strokeWidth="1.6"
      />
      {/* Right sheath (iris) */}
      <ellipse
        cx="18.5"
        cy="14"
        rx="5"
        ry="3.5"
        stroke="#1fa9a5"
        strokeWidth="1.6"
      />
      {/* Node of Ranvier — signal dot */}
      <circle cx="14" cy="14" r="2" fill="#1fa9a5" />
      <circle cx="14" cy="14" r="1" fill="white" />
    </svg>
  );
}

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/demo", label: "Demo" },
  { href: "/themes", label: "Themes" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={[
        "fixed top-0 left-0 right-0 z-50 h-14",
        "flex items-center justify-between px-6",
        "transition-all duration-250",
        scrolled
          ? "bg-background/92 border-b border-border/60 backdrop-blur-2xl"
          : "bg-transparent border-b border-transparent",
      ].join(" ")}
    >
      {/* Logo */}
      <Link href="/">
        <div className="flex items-center gap-2.5 cursor-pointer select-none group">
          <MyelinMark />
          <span className="font-bold text-[14px] tracking-[0.12em] text-foreground group-hover:text-primary transition-colors duration-150">
            MYELIN
          </span>
        </div>
      </Link>

      {/* Nav */}
      <div className="flex items-center gap-0.5">
        {LINKS.map(({ href, label }) => {
          const active =
            location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <Button
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                {label}
              </Button>
            </Link>
          );
        })}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <Badge
          variant="outline"
          className="font-mono text-[10px] hidden sm:flex tracking-widest"
        >
          v0.2.0
        </Badge>
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <Link href="/demo">
          <Button size="sm" variant="default" className="gap-1.5">
            Live Demo
          </Button>
        </Link>
      </div>
    </nav>
  );
}
