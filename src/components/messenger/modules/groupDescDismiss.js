/** Group description dismissals (persist; re-show if text changes) */

const DESC_DISMISS_LS_KEY = "messenger.dismissedGroupDesc";

export function readDismissedGroupDesc() {
  try {
    const raw = localStorage.getItem(DESC_DISMISS_LS_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

export function isGroupDescDismissed(convId, description) {
  if (convId == null) return false;
  try {
    const map = readDismissedGroupDesc();
    const entry = map[String(convId)];
    if (!entry) return false;
    // If description text changed since dismiss, show again
    return entry === String(description || "");
  } catch {
    return false;
  }
}

export function persistGroupDescDismiss(convId, description) {
  if (convId == null) return;
  try {
    const map = readDismissedGroupDesc();
    map[String(convId)] = String(description || "");
    localStorage.setItem(DESC_DISMISS_LS_KEY, JSON.stringify(map));
  } catch {
    /* */
  }
}
