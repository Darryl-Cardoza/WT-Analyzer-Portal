"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, type Nest } from "@/components/path-map";

export interface FallPin {
  lat: number;
  lon: number;
  title: string;
  lines: string[];
  color: string;
  /** hard = circle, soft = diamond */
  shape: "circle" | "diamond";
  /** The alert being viewed: bigger, on top, and the map opens zoomed to it. */
  current?: boolean;
  /** The resident's base location: a dark square. */
  base?: boolean;
}

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const DIAMOND = "M 0,-9 9,0 0,9 -9,0 z";
const SQUARE = "M -7,-7 7,-7 7,7 -7,7 z";

/** Zoomed map of a fall and the resident's other recent falls. Hover (or tap) a marker for its details. */
export function FallMap({ pins, nests = [] }: { pins: FallPin[]; nests?: Nest[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<{ map: google.maps.Map; Polygon: typeof google.maps.Polygon } | null>(null);
  const [showNest, setShowNest] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">(KEY ? "loading" : "error");

  useEffect(() => {
    if (!KEY || !el.current) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => !cancelled && setState("error");

    (async () => {
      await loadGoogleMaps(KEY);
      const [{ Map, InfoWindow, Polygon }, { LatLngBounds, SymbolPath }, { Marker }] = await Promise.all([
        google.maps.importLibrary("maps") as Promise<google.maps.MapsLibrary>,
        google.maps.importLibrary("core") as Promise<google.maps.CoreLibrary>,
        google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>,
      ]);
      if (cancelled || !el.current) return;

      const map = new Map(el.current, { mapTypeId: "hybrid", mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
      const bounds = new LatLngBounds();
      // Same behaviour as the geofence map: hover shows, click/tap pins, no auto-pan.
      const info = new InfoWindow({ disableAutoPan: true });
      let pinned = false;
      info.addListener("closeclick", () => (pinned = false));
      map.addListener("click", () => {
        pinned = false;
        info.close();
      });

      for (const p of pins) {
        const position = { lat: p.lat, lng: p.lon };
        bounds.extend(position);
        if (p.current) {
          // A dark ring around this alert's marker so it stands out from the other falls.
          const halo = new Marker({
            map,
            position,
            clickable: false,
            icon: { path: SymbolPath.CIRCLE, fillColor: "#111827", fillOpacity: 0.18, strokeColor: "#111827", strokeOpacity: 0.9, strokeWeight: 3, scale: 26 },
            zIndex: 0,
          });
          cleanups.push(() => halo.setMap(null));
        }
        const marker = new Marker({
          map,
          position,
          title: p.title,
          label: p.current ? { text: "!", color: p.color === "#eab308" ? "#1f2937" : "#fff", fontWeight: "700" } : undefined,
          icon: {
            path: p.base ? SQUARE : p.shape === "diamond" ? DIAMOND : SymbolPath.CIRCLE,
            fillColor: p.base ? "#2b2b3a" : p.color,
            fillOpacity: 1,
            strokeColor: p.current ? "#111827" : "#fff",
            strokeWeight: p.current ? 4 : 2,
            scale: p.base ? 1 : p.current ? (p.shape === "diamond" ? 2.2 : 17) : p.shape === "diamond" ? 1 : 7,
          },
          zIndex: p.current ? 3 : p.base ? 1 : 2,
        });
        const show = () => {
          // Plain text only: nothing from the data is ever parsed as HTML.
          const box = document.createElement("div");
          const heading = document.createElement("strong");
          heading.textContent = p.title;
          box.append(heading);
          for (const line of p.lines) {
            const row = document.createElement("div");
            row.textContent = line;
            box.append(row);
          }
          info.setContent(box);
          info.open({ map, anchor: marker });
        };
        marker.addListener("mouseover", () => !pinned && show());
        marker.addListener("mouseout", () => !pinned && info.close());
        marker.addListener("click", () => {
          pinned = true;
          show();
        });
        cleanups.push(() => marker.setMap(null));
      }

      const current = pins.find((p) => p.current);
      if (pins.length === 1 && current) {
        map.setCenter({ lat: current.lat, lng: current.lon });
        map.setZoom(18);
      } else {
        map.fitBounds(bounds, 48);
        // A single close cluster would fit to an extreme zoom: keep street level at most.
        google.maps.event.addListenerOnce(map, "idle", () => (map.getZoom() ?? 0) > 18 && map.setZoom(18));
      }
      setApi({ map, Polygon });
      setState("ready");
    })().catch((e) => {
      console.error("Fall map could not be drawn:", e);
      if (!cancelled) setState("error");
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [pins]);

  // The resident's assigned nest(s): a highlighted polygon, shown or hidden on request. The view is left alone.
  useEffect(() => {
    if (!api || !showNest || !nests.length) return;
    const shapes = nests.map(
      (n) =>
        new api.Polygon({
          map: api.map,
          paths: n.points.map((m) => ({ lat: m.lat, lng: m.lon })),
          strokeColor: "#f59e0b",
          strokeWeight: 3,
          strokeOpacity: 0.95,
          fillColor: "#f59e0b",
          fillOpacity: 0.22,
          clickable: false,
        }),
    );
    return () => shapes.forEach((sh) => sh.setMap(null));
  }, [api, showNest, nests]);

  return (
    <div>
      {nests.length > 0 && (
        <div role="group" aria-label="Map options" className="mb-3 flex flex-wrap items-center gap-2">
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
        </div>
      )}
      <div className="relative h-80 overflow-hidden rounded-lg border border-line bg-page sm:h-96">
        <div ref={el} className="h-full w-full" role="region" aria-label="Map of this fall and the resident's falls in the same month" />
        {state !== "ready" && (
          <p className="absolute inset-0 grid place-items-center bg-page px-6 text-center text-sm text-muted" role={state === "error" ? "alert" : "status"}>
            {state === "loading" ? "Loading map…" : KEY ? "The map could not be loaded. The coordinates above and the list below have the same positions." : "The map is not set up (no Google Maps key)."}
          </p>
        )}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted" aria-label="Map key">
        <li><span className="mr-1.5 inline-block size-2.5 rounded-full bg-[#b42323] align-middle" /> Hard fall, true fall</li>
        <li><span className="mr-1.5 inline-block size-2.5 rounded-full bg-[#1a73e8] align-middle" /> Hard fall, false positive</li>
        <li><span className="mr-1.5 inline-block size-2.5 rotate-45 bg-[#16a34a] align-middle" /> Soft fall, true fall</li>
        <li><span className="mr-1.5 inline-block size-2.5 rotate-45 bg-[#eab308] align-middle" /> Soft fall, false positive</li>
        <li><span className="mr-1.5 inline-block size-2.5 rounded-full bg-[#6b7280] align-middle" /> Not acknowledged (grey, same shapes)</li>
        <li><span className="mr-1.5 inline-block size-2.5 bg-[#2b2b3a] align-middle" /> Base</li>
        {showNest && nests.length > 0 && (
          <li><span className="mr-1.5 inline-block size-2.5 border-2 border-[#f59e0b] bg-[#f59e0b]/25 align-middle" /> Nest{nests.length > 1 ? "s" : ""}: {nests.map((n) => n.name || n.address || "unnamed").join(", ")}</li>
        )}
        <li><span className="mr-1.5 inline-block size-3.5 rounded-full border-2 border-[#111827] bg-[#111827]/20 align-middle" /> Ringed, largest marker (!): this alert</li>
      </ul>
    </div>
  );
}
