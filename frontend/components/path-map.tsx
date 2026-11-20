"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sampleStops } from "@/lib/path";

export interface MapMarker {
  lat: number;
  lon: number;
  role: "start" | "mid" | "end" | "base";
  title: string;
  /** One line each, shown in the info window when the point is hovered or tapped. */
  lines: string[];
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
type Mode = "straight" | "road";
const toLatLng = (m: { lat: number; lon: number }) => ({ lat: m.lat, lng: m.lon });
const COLOR = { line: "#1a73e8", start: "#0f7a5c", mid: "#8250b9", end: "#b42323", base: "#2b2b3a", nest: "#f59e0b" } as const;

let loading: Promise<void> | null = null;
/** Adds Google's script once. The page's CSP allows it by host (maps.googleapis.com, maps.gstatic.com in script-src): see scripts/swa-config.mjs. */
export function loadGoogleMaps(key: string): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    // With loading=async, Google's API (google.maps.importLibrary) is only ready when it calls this callback, not at the
    // script's own onload.
    (window as unknown as Record<string, unknown>).__onGoogleMapsReady = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__onGoogleMapsReady`;
    script.async = true;
    script.onerror = () => {
      loading = null; // allow a retry
      reject(new Error("load"));
    };
    document.head.append(script);
  });
  return loading;
}

/** The path the resident's GPS travelled, on a Google map. `markers` are in time order (the base, if any, last). */
export interface Nest {
  name: string | null;
  address: string | null;
  isActive: boolean | null;
  points: { lat: number; lon: number }[];
}

export function PathMap({ markers, estimated, nests = [] }: { markers: MapMarker[]; estimated: boolean; nests?: Nest[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">(KEY ? "loading" : "error");
  const [api, setApi] = useState<{ map: google.maps.Map; Polyline: typeof google.maps.Polyline; Polygon: typeof google.maps.Polygon } | null>(null);
  const [showNest, setShowNest] = useState(false);
  const [mode, setMode] = useState<Mode>("straight");
  const [roadMeters, setRoadMeters] = useState<number | null>(null);
  const [roadError, setRoadError] = useState(false);
  const routeCache = useRef<{ key: string; path: google.maps.LatLngLiteral[]; meters: number | null } | null>(null);
  const route = useMemo(() => markers.filter((m) => m.role !== "base"), [markers]);

  // The map and its markers. The line is drawn by the next effect, because the toggle redraws only the line.
  useEffect(() => {
    if (!KEY || !el.current) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    // Google calls this when the key is rejected (wrong referrer, API not enabled, billing).
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => !cancelled && setState("error");

    (async () => {
      await loadGoogleMaps(KEY);
      const [{ Map, Polyline, Polygon, InfoWindow }, { LatLngBounds, SymbolPath }, { Marker }] = await Promise.all([
        google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
        google.maps.importLibrary("core") as Promise<google.maps.CoreLibrary>,
        google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
      ]);
      if (cancelled || !el.current) return;

      const map = new Map(el.current, { mapTypeId: "hybrid", mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
      const bounds = new LatLngBounds();
      // One info window: it follows the pointer over a point (hover) and a click or tap pins it open, since touch screens
      // have no hover. It does not pan the map, so hovering never makes the view jump.
      const info = new InfoWindow({ disableAutoPan: true });
      let pinned = false;
      info.addListener("closeclick", () => (pinned = false));
      map.addListener("click", () => {
        pinned = false;
        info.close();
      });

      for (const m of markers) {
        const position = { lat: m.lat, lng: m.lon };
        bounds.extend(position);
        const marker = new Marker({
          map,
          position,
          title: m.title,
          label: m.role === "start" ? { text: "S", color: "#fff", fontWeight: "700" } : m.role === "end" ? { text: "E", color: "#fff", fontWeight: "700" } : undefined,
          icon:
            m.role === "base"
              ? { path: "M -7,-7 7,-7 7,7 -7,7 z", fillColor: COLOR.base, fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 1 }
              : {
                  path: SymbolPath.CIRCLE,
                  fillColor: COLOR[m.role],
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                  scale: m.role === "mid" ? 6 : 11,
                },
          zIndex: m.role === "mid" ? 1 : 2,
        });
        const show = () => {
          // Plain text only: nothing from the data is ever parsed as HTML.
          const box = document.createElement("div");
          const heading = document.createElement("strong");
          heading.textContent = m.title;
          box.append(heading);
          for (const line of m.lines) {
            const row = document.createElement("div");
            row.textContent = line;
            box.append(row);
          }
          info.setContent(box);
          info.open({ map, anchor: marker });
        };
        marker.addListener("mouseover", () => {
          if (!pinned) show();
        });
        marker.addListener("mouseout", () => {
          if (!pinned) info.close();
        });
        marker.addListener("click", () => {
          pinned = true;
          show();
        });
        cleanups.push(() => marker.setMap(null));
      }

      if (markers.length === 1) {
        map.setCenter({ lat: markers[0].lat, lng: markers[0].lon });
        map.setZoom(17);
      } else {
        map.fitBounds(bounds, 48);
      }
      setApi({ map, Polyline, Polygon });
      setState("ready");
    })().catch((e) => {
      console.error("Path map could not be drawn:", e);
      if (!cancelled) setState("error");
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [markers]);

  // The line: straight between the GPS fixes, or a walking route along streets (Routes API, fetched once per alert).
  useEffect(() => {
    if (!api || route.length < 2) return;
    let cancelled = false;
    let line: google.maps.Polyline | null = null;

    (async () => {
      if (mode === "road") {
        try {
          const key = route.map((m) => `${m.lat},${m.lon}`).join("|");
          if (routeCache.current?.key !== key) {
            const { Route } = (await google.maps.importLibrary("routes")) as google.maps.RoutesLibrary;
            const stops = sampleStops(route).map(toLatLng);
            const { routes } = await Route.computeRoutes({
              origin: stops[0],
              destination: stops[stops.length - 1],
              intermediates: stops.slice(1, -1).map((location) => ({ location })),
              travelMode: "WALKING",
              fields: ["path", "distanceMeters"],
            });
            const found = routes?.[0];
            if (!found?.path?.length) throw new Error("No route found");
            routeCache.current = { key, path: found.path.map((p) => ({ lat: p.lat, lng: p.lng })), meters: found.distanceMeters ?? null };
          }
          if (cancelled) return;
          line = new api.Polyline({ map: api.map, path: routeCache.current!.path, strokeColor: COLOR.line, strokeWeight: 4, strokeOpacity: 0.85 });
          setRoadMeters(routeCache.current!.meters);
        } catch (e) {
          console.error("Road route unavailable, showing the straight line:", e);
          if (cancelled) return;
          setRoadError(true);
          setMode("straight"); // re-runs this effect and draws the straight line
        }
        return;
      }
      line = new api.Polyline({
        map: api.map,
        path: route.map(toLatLng),
        strokeColor: COLOR.line,
        strokeWeight: 4,
        // Estimated: dashed, drawn with repeating icons because Polyline has no dash option.
        ...(estimated
          ? { strokeOpacity: 0, icons: [{ icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" }] }
          : { strokeOpacity: 0.85 }),
      });
    })();

    return () => {
      cancelled = true;
      line?.setMap(null);
    };
  }, [api, mode, estimated, route]);

  // The resident's assigned nest(s): a highlighted polygon, shown or hidden on request. The view (zoom, position) is left alone.
  useEffect(() => {
    if (!api || !showNest || !nests.length) return;
    const shapes = nests.map(
      (n) =>
        new api.Polygon({
          map: api.map,
          paths: n.points.map(toLatLng),
          strokeColor: COLOR.nest,
          strokeWeight: 3,
          strokeOpacity: 0.95,
          fillColor: COLOR.nest,
          fillOpacity: 0.22,
          clickable: false,
        }),
    );
    return () => shapes.forEach((s) => s.setMap(null));
  }, [api, showNest, nests]);

  const choose = (next: Mode) => {
    setRoadError(false);
    setMode(next);
  };

  return (
    <div>
      {(route.length >= 2 || nests.length > 0) && (
        <div role="group" aria-label="Map options" className="mb-3 flex flex-wrap items-center gap-2">
          {(route.length >= 2
            ? ([
                ["straight", "Straight line"],
                ["road", "Road route"],
              ] as const)
            : []
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              disabled={!api}
              onClick={() => choose(value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                mode === value ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white text-ink/80 hover:bg-brand-faint"
              }`}
            >
              {label}
            </button>
          ))}
          {nests.length > 0 && (
            <button
              type="button"
              aria-pressed={showNest}
              disabled={!api}
              onClick={() => setShowNest((v) => !v)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                showNest ? "border-brand bg-brand-soft text-brand-dark" : "border-line bg-white text-ink/80 hover:bg-brand-faint"
              }`}
            >
              {nests.length > 1 ? "Show nests" : "Show nest"}
            </button>
          )}
        </div>
      )}
      <div className="relative h-80 overflow-hidden rounded-lg border border-line bg-page sm:h-96">
        <div ref={el} className="h-full w-full" role="region" aria-label="Map of the GPS path during the alert" />
        {state !== "ready" && (
          <p className="absolute inset-0 grid place-items-center bg-page px-6 text-center text-sm text-muted" role={state === "error" ? "alert" : "status"}>
            {state === "loading"
              ? "Loading map…"
              : KEY
                ? "The map could not be loaded. The GPS fixes table below has the same positions."
                : "The map is not set up (no Google Maps key). The GPS fixes table below has the same positions."}
          </p>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Map key">
        <li><span className="mr-1.5 inline-block h-1 w-4 rounded-full bg-[#1a73e8] align-middle" /> Path</li>
        <li><Dot tone="bg-[#0f7a5c]" /> S: last fix before the alert</li>
        <li><Dot tone="bg-[#8250b9]" /> Fix during the alert</li>
        <li><Dot tone="bg-[#b42323]" /> E: first fix after the alert</li>
        <li><span className="mr-1.5 inline-block size-2.5 bg-[#2b2b3a] align-middle" /> Base</li>
        {showNest && nests.length > 0 && (
          <li><span className="mr-1.5 inline-block size-2.5 border-2 border-[#f59e0b] bg-[#f59e0b]/25 align-middle" /> Nest{nests.length > 1 ? "s" : ""}: {nests.map((n) => n.name || n.address || "unnamed").join(", ")}</li>
        )}
        {estimated && mode === "straight" && <li>Dashed line: estimated, no fixes were recorded in between</li>}
        {mode === "road" && (
          <li>
            Walking route along streets between the fixes{roadMeters === null ? "" : `, about ${Math.round(roadMeters)} m`}. It is a guide: the GPS fixes themselves are the record.
          </li>
        )}
        {roadError && <li role="status">The road route could not be loaded (the Routes API may not be enabled for this key), so the straight line is shown.</li>}
      </ul>
    </div>
  );
}

// Classes, not style="": the page's CSP blocks inline style attributes.
function Dot({ tone }: { tone: string }) {
  return <span className={`mr-1.5 inline-block size-2.5 rounded-full align-middle ${tone}`} />;
}
