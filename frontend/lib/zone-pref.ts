import { useSyncExternalStore } from "react";
import { ZONE_KEY, parseZone, type ZoneChoice } from "./timezone";

// A per-browser preference in localStorage (no server, so no cookie). It is a small shared store so that the header's
// toggle updates every page that shows times, at once, and other tabs follow. Browser only: read it from effects or the hook.

// Also kept here so the choice still works for this page view when the browser blocks storage.
let memory: ZoneChoice = "site";
const listeners = new Set<() => void>();

export function getZoneChoice(): ZoneChoice {
  try {
    return parseZone(localStorage.getItem(ZONE_KEY));
  } catch {
    return memory; // storage blocked or missing
  }
}

export function setZoneChoice(choice: ZoneChoice) {
  memory = choice;
  try {
    localStorage.setItem(ZONE_KEY, choice);
  } catch {
    // blocked: the choice lasts for this page view only
  }
  listeners.forEach((notify) => notify());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // a change made in another tab
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The current choice. Prerendered HTML and the first hydration pass use the site zone, then the stored choice takes over. */
export const useZoneChoice = (): ZoneChoice => useSyncExternalStore(subscribe, getZoneChoice, () => "site");
