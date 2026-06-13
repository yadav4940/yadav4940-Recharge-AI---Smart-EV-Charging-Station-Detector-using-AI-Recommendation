import { useEffect, useRef, useState } from "react";
import type { MapMarker } from "@/components/LeafletMap";
import LeafletMap from "@/components/LeafletMap";

type Props = {
  markers: MapMarker[];
  routePoints?: [number, number][];
  center?: [number, number];
  zoom?: number;
  className?: string;
  onMarkerClick?: (marker: MapMarker) => void;
};

declare global {
  interface Window {
    mappls?: any;
    __mapplsInitCallbacks?: Array<() => void>;
    __mapplsLoaded?: boolean;
    __mapplsLoading?: boolean;
    __mapplsToken?: string | null;
  }
}

const fetchMapplsToken = async (): Promise<string | null> => {
  if (window.__mapplsToken !== undefined) return window.__mapplsToken;
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/mappls-token`,
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      }
    );
    if (!res.ok) {
      window.__mapplsToken = null;
      return null;
    }
    const data = await res.json();
    window.__mapplsToken = data.access_token || null;
    return window.__mapplsToken;
  } catch {
    window.__mapplsToken = null;
    return null;
  }
};

const loadMapplsSDK = (token: string): Promise<void> =>
  new Promise((resolve, reject) => {
    if (window.__mapplsLoaded && window.mappls) {
      resolve();
      return;
    }
    if (window.__mapplsLoading) {
      window.__mapplsInitCallbacks = window.__mapplsInitCallbacks || [];
      window.__mapplsInitCallbacks.push(() => resolve());
      return;
    }

    window.__mapplsLoading = true;
    window.__mapplsInitCallbacks = [];

    (window as any).initMapplsSDK = () => {
      window.__mapplsLoaded = true;
      window.__mapplsLoading = false;
      resolve();
      window.__mapplsInitCallbacks?.forEach((cb) => cb());
      window.__mapplsInitCallbacks = [];
    };

    const script = document.createElement("script");
    script.src = `https://apis.mappls.com/advancedmaps/api/${token}/map_sdk?layer=vector&v=3.0&callback=initMapplsSDK`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      window.__mapplsLoading = false;
      reject(new Error("Failed to load Mappls SDK"));
    };
    document.head.appendChild(script);
  });

let containerCounter = 0;

const MapplsMap = ({ markers, routePoints, center, zoom = 6, className = "", onMarkerClick }: Props) => {
  const containerIdRef = useRef<string>(`mappls-map-${++containerCounter}-${Date.now()}`);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Step 1: Load SDK
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await fetchMapplsToken();
      if (!token) {
        if (!cancelled) setFailed(true);
        return;
      }
      try {
        await loadMapplsSDK(token);
        if (!cancelled) setSdkReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Step 2: Init map after SDK is ready AND container is mounted with size
  useEffect(() => {
    if (!sdkReady || mapRef.current) return;
    const mappls = window.mappls;
    if (!mappls?.Map) {
      setFailed(true);
      return;
    }

    let attempts = 0;
    let raf = 0;
    const tryInit = () => {
      const el = document.getElementById(containerIdRef.current);
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) {
        if (attempts++ < 50) {
          raf = requestAnimationFrame(tryInit);
          return;
        }
        console.warn("Mappls: container not ready, falling back");
        setFailed(true);
        return;
      }
      try {
        mapRef.current = new mappls.Map(containerIdRef.current, {
          center: center || [20.5937, 78.9629],
          zoom,
          zoomControl: true,
          location: false,
        });
        // Wait for load event if available
        if (mapRef.current?.addListener) {
          try {
            mapRef.current.addListener("load", () => setMapReady(true));
          } catch {}
        }
        // Fallback: mark ready shortly after
        setTimeout(() => setMapReady(true), 300);
      } catch (e) {
        console.error("Mappls map init error:", e);
        setFailed(true);
      }
    };
    raf = requestAnimationFrame(tryInit);
    return () => cancelAnimationFrame(raf);
  }, [sdkReady]);

  // Step 3: Update markers + route + view (only after map is ready)
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const mappls = window.mappls;
    if (!map || !mappls) return;

    markersRef.current.forEach((m) => {
      try { m.remove?.(); } catch {}
    });
    markersRef.current = [];

    if (polylineRef.current) {
      try { polylineRef.current.remove?.(); } catch {}
      polylineRef.current = null;
    }

    const colorByType: Record<string, string> = {
      "station-available": "#22c55e",
      "station-busy": "#f59e0b",
      "station-offline": "#ef4444",
      station: "#22c55e",
      start: "#3b82f6",
      end: "#ef4444",
      stop: "#f59e0b",
    };

    markers.forEach((m) => {
      const color = colorByType[m.type || "station"] || "#22c55e";
      const html = `<div style="width:30px;height:30px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold">⚡</div>`;
      try {
        const marker = new mappls.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          html,
          popupHtml: m.popup || `<strong>${m.label}</strong>`,
          popupOptions: { openPopup: false },
        });
        if (onMarkerClick && marker?.addListener) {
          try {
            marker.addListener("click", () => onMarkerClick(m));
          } catch {}
        }
        markersRef.current.push(marker);
      } catch (e) {
        console.warn("marker error", e);
      }
    });

    if (routePoints && routePoints.length > 1) {
      try {
        polylineRef.current = new mappls.Polyline({
          map,
          paths: routePoints.map(([lat, lng]) => ({ lat, lng })),
          strokeColor: "#6366f1",
          strokeOpacity: 0.7,
          strokeWeight: 4,
        });
      } catch {}
    }

    if (markers.length > 0) {
      try {
        const bounds = markers.map((m) => [m.lat, m.lng]);
        map.fitBounds?.(bounds, { padding: 60, maxZoom: 13 });
      } catch {
        if (center) map.setCenter?.({ lat: center[0], lng: center[1] });
      }
    } else if (center) {
      try {
        map.setCenter?.({ lat: center[0], lng: center[1] });
        map.setZoom?.(zoom);
      } catch {}
    }
  }, [markers, routePoints, center, zoom, mapReady]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      try { mapRef.current?.remove?.(); } catch {}
      mapRef.current = null;
    };
  }, []);

  if (failed) {
    return (
      <LeafletMap
        markers={markers}
        routePoints={routePoints}
        center={center}
        zoom={zoom}
        className={className}
        onMarkerClick={onMarkerClick}
      />
    );
  }

  return (
    <div className={`relative w-full rounded-lg border border-border overflow-hidden ${className}`} style={{ height: "350px", minHeight: "250px" }}>
      <div id={containerIdRef.current} ref={containerRef} className="w-full h-full" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 text-xs text-muted-foreground pointer-events-none">
          Loading Mappls map…
        </div>
      )}
      <div className="absolute bottom-2 right-2 z-[1000] text-[10px] px-2 py-0.5 rounded bg-black/60 text-white font-medium">
        Powered by Mappls
      </div>
    </div>
  );
};

export default MapplsMap;
