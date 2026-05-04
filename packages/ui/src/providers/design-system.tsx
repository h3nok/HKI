"use client";

import React from "react";
import { createCache, StyleProvider } from "@ant-design/cssinjs";
import type Entity from "@ant-design/cssinjs/es/Cache";
import { ConfigProvider } from "antd";
import { signatureTheme } from "../theme/tokens";

// CSR-compatible style registry (no Next.js SSR dependency)
// For Next.js App Router SSR, wrap your layout with @ant-design/nextjs-registry instead.
const StyledComponentsRegistry = ({ children }: { children: React.ReactNode }) => {
  const cache = React.useMemo<Entity>(() => createCache(), []);
  return <StyleProvider cache={cache}>{children as any}</StyleProvider>;
};

// Layer: Theming & Governance
// "DesignSystemProvider" wraps the app with the "Contract" (Tokens)

interface DesignSystemProviderProps {
  children: React.ReactNode;
}

export function DesignSystemProvider({ children }: DesignSystemProviderProps) {
  return (
    <StyledComponentsRegistry>
      <ConfigProvider theme={signatureTheme}>{children as any}</ConfigProvider>
    </StyledComponentsRegistry>
  );
}
