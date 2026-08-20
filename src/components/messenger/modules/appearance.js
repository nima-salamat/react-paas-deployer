/**
 * Messenger appearance — color themes, avatar visibility, bubble layout styles.
 * Persisted in localStorage; color theme is also applied at App ThemeProvider level.
 */

export const COLOR_THEME_KEY = "paas-color-theme";
export const APPEARANCE_KEY = "messenger.appearance.v1";

/** @typedef {"ocean" | "indigo" | "aurora" | "emerald" | "cyan" | "rose" | "amber" | "default"} ColorThemeId */
/** @typedef {"modern" | "overlap" | "irc"} BubbleStyle */

/**
 * Full palette tokens for each colored theme (dark + light).
 * `default` keeps the existing App blues.
 */
export const COLOR_THEMES = {
  default: {
    id: "default",
    label: "Default",
    emoji: "⚪",
    dark: {
      primary: "#8ab4ff",
      primaryHover: "#a6c5ff",
      primarySoft: "#1e3a5f",
      background: "#0b1020",
      surface: "#111827",
      surfaceElevated: "#182235",
      surfaceHover: "#1e293b",
      border: "#263449",
      borderStrong: "#334155",
      text: "#e5e7eb",
      textSecondary: "#9ca3af",
      textMuted: "#94a3b8",
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
      bubbleMine: "#2b5278",
    },
    light: {
      primary: "#2f66ff",
      primaryHover: "#1d4ed8",
      primarySoft: "#dbeafe",
      background: "#f7f9fc",
      surface: "#ffffff",
      surfaceElevated: "#ffffff",
      surfaceHover: "#f1f5f9",
      border: "#e2e8f0",
      borderStrong: "#cbd5e1",
      text: "#0f172a",
      textSecondary: "#475569",
      textMuted: "#94a3b8",
      success: "#16a34a",
      warning: "#d97706",
      danger: "#dc2626",
      bubbleMine: null, // use primary.main
    },
  },
  ocean: {
    id: "ocean",
    label: "Ocean Blue",
    emoji: "🔵",
    tagline: "Professional",
    dark: {
      primary: "#3B82F6",
      primaryHover: "#60A5FA",
      primarySoft: "#172554",
      background: "#0B1120",
      surface: "#111827",
      surfaceElevated: "#182235",
      surfaceHover: "#1E293B",
      border: "#263449",
      borderStrong: "#334155",
      text: "#F8FAFC",
      textSecondary: "#CBD5E1",
      textMuted: "#94A3B8",
      success: "#22C55E",
      warning: "#F59E0B",
      danger: "#EF4444",
      bubbleMine: "#1e4a8c",
    },
    light: {
      primary: "#2563EB",
      primaryHover: "#1D4ED8",
      primarySoft: "#DBEAFE",
      background: "#F8FAFC",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceHover: "#F1F5F9",
      border: "#E2E8F0",
      borderStrong: "#CBD5E1",
      text: "#0F172A",
      textSecondary: "#475569",
      textMuted: "#94A3B8",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#DC2626",
      bubbleMine: null,
    },
  },
  indigo: {
    id: "indigo",
    label: "Indigo",
    emoji: "🟣",
    tagline: "Premium",
    dark: {
      primary: "#6366F1",
      primaryHover: "#818CF8",
      primarySoft: "#1E1B4B",
      background: "#0D0E1A",
      surface: "#131522",
      surfaceElevated: "#191B2B",
      surfaceHover: "#202337",
      border: "#282B3D",
      borderStrong: "#363A50",
      text: "#F8F8FF",
      textSecondary: "#C7C9D9",
      textMuted: "#9296AA",
      success: "#22C55E",
      warning: "#F59E0B",
      danger: "#F43F5E",
      bubbleMine: "#3f3d9e",
    },
    light: {
      primary: "#4F46E5",
      primaryHover: "#4338CA",
      primarySoft: "#E0E7FF",
      background: "#F8F8FF",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceHover: "#F1F2FA",
      border: "#E4E5EF",
      borderStrong: "#D1D3E0",
      text: "#181A27",
      textSecondary: "#505467",
      textMuted: "#8B8F9F",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#E11D48",
      bubbleMine: null,
    },
  },
  aurora: {
    id: "aurora",
    label: "Aurora Purple",
    emoji: "💜",
    tagline: "Modern / AI",
    dark: {
      primary: "#8B5CF6",
      primaryHover: "#A78BFA",
      primarySoft: "#2E1065",
      background: "#0F0D17",
      surface: "#171421",
      surfaceElevated: "#1E1A2B",
      surfaceHover: "#282236",
      border: "#302A3D",
      borderStrong: "#403750",
      text: "#FAF9FF",
      textSecondary: "#D0CADB",
      textMuted: "#9891A5",
      success: "#34D399",
      warning: "#FBBF24",
      danger: "#FB7185",
      bubbleMine: "#5b3aa0",
    },
    light: {
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      primarySoft: "#EDE9FE",
      background: "#FAF9FF",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceHover: "#F5F3FF",
      border: "#E8E3F0",
      borderStrong: "#D8D1E5",
      text: "#1C1724",
      textSecondary: "#5F586B",
      textMuted: "#91899D",
      success: "#059669",
      warning: "#D97706",
      danger: "#E11D48",
      bubbleMine: null,
    },
  },
  emerald: {
    id: "emerald",
    label: "Emerald",
    emoji: "🟢",
    tagline: "Fresh / Calm",
    dark: {
      primary: "#10B981",
      primaryHover: "#34D399",
      primarySoft: "#064E3B",
      background: "#081512",
      surface: "#0F1D19",
      surfaceElevated: "#152621",
      surfaceHover: "#1B302A",
      border: "#203B33",
      borderStrong: "#2B4D42",
      text: "#F0FDF9",
      textSecondary: "#C6DDD5",
      textMuted: "#8BA79E",
      success: "#22C55E",
      warning: "#F59E0B",
      danger: "#F43F5E",
      bubbleMine: "#0d6b4f",
    },
    light: {
      primary: "#059669",
      primaryHover: "#047857",
      primarySoft: "#D1FAE5",
      background: "#F7FCFA",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceHover: "#ECFDF5",
      border: "#DCECE6",
      borderStrong: "#C7DED6",
      text: "#10201B",
      textSecondary: "#49635A",
      textMuted: "#82978F",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#DC2626",
      bubbleMine: null,
    },
  },
  cyan: {
    id: "cyan",
    label: "Cyan",
    emoji: "🩵",
    tagline: "Tech / Futuristic",
    dark: {
      primary: "#06B6D4",
      primaryHover: "#22D3EE",
      primarySoft: "#083344",
      background: "#071317",
      surface: "#0D1C21",
      surfaceElevated: "#12272E",
      surfaceHover: "#17323A",
      border: "#1D3B43",
      borderStrong: "#28515B",
      text: "#F0FDFF",
      textSecondary: "#C4E0E5",
      textMuted: "#82A4AB",
      success: "#22C55E",
      warning: "#F59E0B",
      danger: "#F43F5E",
      bubbleMine: "#0a6f82",
    },
    light: {
      primary: "#0891B2",
      primaryHover: "#0E7490",
      primarySoft: "#CFFAFE",
      background: "#F7FCFD",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceHover: "#ECFEFF",
      border: "#D9ECEF",
      borderStrong: "#C5E0E5",
      text: "#102126",
      textSecondary: "#49636A",
      textMuted: "#82979D",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#DC2626",
      bubbleMine: null,
    },
  },
  rose: {
    id: "rose",
    label: "Rose",
    emoji: "🩷",
    tagline: "Social / Friendly",
    dark: {
      primary: "#F43F5E",
      primaryHover: "#FB7185",
      primarySoft: "#4C0519",
      background: "#160C10",
      surface: "#211116",
      surfaceElevated: "#2A161D",
      surfaceHover: "#351B24",
      border: "#45222D",
      borderStrong: "#5A2B39",
      text: "#FFF7F8",
      textSecondary: "#E5C9CF",
      textMuted: "#A98B92",
      success: "#22C55E",
      warning: "#F59E0B",
      danger: "#FB7185",
      bubbleMine: "#9b1d3a",
    },
    light: {
      primary: "#E11D48",
      primaryHover: "#BE123C",
      primarySoft: "#FFE4E6",
      background: "#FFF8F9",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceHover: "#FFF1F2",
      border: "#F1DDE1",
      borderStrong: "#E9C8CF",
      text: "#241419",
      textSecondary: "#674A52",
      textMuted: "#9A7E85",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#BE123C",
      bubbleMine: null,
    },
  },
  amber: {
    id: "amber",
    label: "Amber",
    emoji: "🟠",
    tagline: "Warm / Unique",
    dark: {
      primary: "#F59E0B",
      primaryHover: "#FBBF24",
      primarySoft: "#451A03",
      background: "#151108",
      surface: "#201A0D",
      surfaceElevated: "#292110",
      surfaceHover: "#342A14",
      border: "#443618",
      borderStrong: "#5A471F",
      text: "#FFFBEB",
      textSecondary: "#E6D8B3",
      textMuted: "#A99B76",
      success: "#22C55E",
      warning: "#FBBF24",
      danger: "#EF4444",
      bubbleMine: "#9a6a0a",
    },
    light: {
      primary: "#D97706",
      primaryHover: "#B45309",
      primarySoft: "#FEF3C7",
      background: "#FFFCF5",
      surface: "#FFFFFF",
      surfaceElevated: "#FFFFFF",
      surfaceHover: "#FFFBEB",
      border: "#EFE5D0",
      borderStrong: "#E4D5B7",
      text: "#211A0D",
      textSecondary: "#665A43",
      textMuted: "#998D76",
      success: "#16A34A",
      warning: "#D97706",
      danger: "#DC2626",
      bubbleMine: null,
    },
  },
};

export const COLOR_THEME_LIST = Object.values(COLOR_THEMES);

export const BUBBLE_STYLES = [
  {
    id: "modern",
    label: "Modern",
    description: "Telegram-style side avatars and grouped bubbles",
  },
  {
    id: "overlap",
    label: "Message bubble",
    description: "Avatar sits on the corner of each bubble",
  },
  {
    id: "irc",
    label: "IRC",
    description: "Linear left-aligned chat; avatars always on the left",
  },
];

const DEFAULT_APPEARANCE = {
  showOwnAvatar: true,
  showOthersAvatar: true,
  bubbleStyle: /** @type {BubbleStyle} */ ("modern"),
  colorTheme: /** @type {ColorThemeId} */ ("default"),
};

export function normalizeColorThemeId(id) {
  if (id && COLOR_THEMES[id]) return id;
  return "default";
}

export function getPalette(colorThemeId, mode) {
  const theme = COLOR_THEMES[normalizeColorThemeId(colorThemeId)] || COLOR_THEMES.default;
  const m = mode === "dark" ? "dark" : "light";
  return theme[m];
}

export function readColorThemeId() {
  try {
    return normalizeColorThemeId(localStorage.getItem(COLOR_THEME_KEY));
  } catch {
    return "default";
  }
}

export function writeColorThemeId(id) {
  const v = normalizeColorThemeId(id);
  try {
    localStorage.setItem(COLOR_THEME_KEY, v);
  } catch { /* */ }
  return v;
}

export function readAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE, colorTheme: readColorThemeId() };
    const parsed = JSON.parse(raw);
    // Migrate legacy showAvatars → both toggles
    const legacyShow = parsed.showAvatars;
    const showOwn = parsed.showOwnAvatar != null
      ? parsed.showOwnAvatar !== false
      : legacyShow !== false;
    const showOthers = parsed.showOthersAvatar != null
      ? parsed.showOthersAvatar !== false
      : legacyShow !== false;
    return {
      showOwnAvatar: showOwn,
      showOthersAvatar: showOthers,
      bubbleStyle: ["modern", "overlap", "irc"].includes(parsed.bubbleStyle)
        ? parsed.bubbleStyle
        : "modern",
      colorTheme: normalizeColorThemeId(parsed.colorTheme || readColorThemeId()),
    };
  } catch {
    return { ...DEFAULT_APPEARANCE, colorTheme: readColorThemeId() };
  }
}

export function writeAppearance(partial) {
  const next = { ...readAppearance(), ...partial };
  next.colorTheme = normalizeColorThemeId(next.colorTheme);
  if (!["modern", "overlap", "irc"].includes(next.bubbleStyle)) next.bubbleStyle = "modern";
  next.showOwnAvatar = next.showOwnAvatar !== false;
  next.showOthersAvatar = next.showOthersAvatar !== false;
  delete next.showAvatars;
  try {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  } catch { /* */ }
  if (partial.colorTheme != null) writeColorThemeId(next.colorTheme);
  return next;
}
