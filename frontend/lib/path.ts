import type { GpsFix } from "@/lib/alerts";

export interface PathPoint {
  lat: number;
  lon: number;
  /** start = last fix before the alert, end = first fix after it, mid = a fix during it. */
  role: "start" | "mid" | "end";
  fix: GpsFix;
}

/**
 * The route to draw: the last fix before the alert, the fixes during it, the first fix after it. The analyzer already
 * returns them in that order, so this only drops fixes without usable coordinates and names each point's role.
 * `estimated` means the line is a straight hop between two fixes, because nothing was recorded during the alert.
 */
export function buildPath(fixes: GpsFix[]): { points: PathPoint[]; estimated: boolean } {
  const usable = fixes.filter((f) => Number.isFinite(f.latitude) && Number.isFinite(f.longitude));
  const points = usable.map((fix): PathPoint => ({
    lat: fix.latitude,
    lon: fix.longitude,
    role: fix.category === "BEFORE" ? "start" : fix.category === "AFTER" ? "end" : "mid",
    fix,
  }));
  const estimated = points.length >= 2 && !points.some((p) => p.role === "mid");
  return { points, estimated };
}

/**
 * The Routes API takes an origin, a destination and at most 25 stops between them. Keeps both ends and spreads the
 * remaining stops evenly across the rest of the path.
 */
export function sampleStops<T>(points: T[], maxIntermediates = 25): T[] {
  if (points.length <= maxIntermediates + 2) return points;
  const inner = points.slice(1, -1);
  const picked = Array.from({ length: maxIntermediates }, (_, i) => inner[Math.round((i * (inner.length - 1)) / (maxIntermediates - 1))]);
  return [points[0], ...picked, points[points.length - 1]];
}
