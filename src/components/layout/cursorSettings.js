export const CURSOR_STORAGE_KEY = "paas-cursor-preference";
export const DEFAULT_CURSOR = "default";

export const CURSOR_OPTIONS = [
  {
    id: "default",
    label: "System default",
    description: "Use the normal browser and operating-system cursor.",
  },
  {
    id: "custom",
    label: "Custom",
    description: "Use the PassDeployer ring cursor on desktop.",
  },
];

const VALID_CURSOR_IDS = new Set(CURSOR_OPTIONS.map((option) => option.id));

export function normalizeCursorPreference(value) {
  return VALID_CURSOR_IDS.has(value) ? value : DEFAULT_CURSOR;
}

export function readCursorPreference() {
  if (typeof window === "undefined") return DEFAULT_CURSOR;
  try {
    return normalizeCursorPreference(window.localStorage.getItem(CURSOR_STORAGE_KEY));
  } catch {
    return DEFAULT_CURSOR;
  }
}

export function writeCursorPreference(value) {
  const normalized = normalizeCursorPreference(value);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CURSOR_STORAGE_KEY, normalized);
      window.dispatchEvent(
        new CustomEvent("passdeployer:cursor-preference", {
          detail: normalized,
        }),
      );
    } catch {
      // Keep the in-memory preference even when localStorage is unavailable.
    }
  }
  return normalized;
}
