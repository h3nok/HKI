/**
 * GOOGLE MAPS COMPONENT
 *
 * Agentic map component.
 * Uses Frontend Forge proxy for API key security.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// We need to implement a simple usePersistFn or use useCallback/useRef if not available
// For now, I'll implement a simple version inside or just use useEffect properly.
function usePersistFn<T extends (...args: any[]) => any>(fn: T) {
  const ref = useRef(fn);
  ref.current = fn;
  const persistFn = useRef((...args: Parameters<T>) => ref.current(...args));
  return persistFn.current as T;
}

declare global {
  interface Window {
    google?: typeof google;
  }
}

// These should be in your .env
const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

function loadMapScript() {
  return new Promise(resolve => {
    if (window.google?.maps) {
      resolve(null);
      return;
    }

    const script = document.createElement("script");
    // Note: Adjust libraries as needed
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      resolve(null);
    };
    script.onerror = () => {
      console.error("Failed to load Google Maps script");
    };
    document.head.appendChild(script);
  });
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);

  const init = usePersistFn(async () => {
    await loadMapScript();
    if (!mapContainer.current) {
      console.error("Map container not found");
      return;
    }

    // Check if map already initialized
    if (map.current) return;

    map.current = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: true,
      mapId: "DEMO_MAP_ID", // Replace with real Map ID if you have one for Advanced Markers
    });

    if (onMapReady) {
      onMapReady(map.current);
    }
  });

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div
      ref={mapContainer}
      className={cn(
        "w-full h-[500px] rounded-xl overflow-hidden shadow-sm border border-border",
        className
      )}
    />
  );
}
