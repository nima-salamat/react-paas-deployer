import createCache from "@emotion/cache";
import rtlPlugin from "@mui/stylis-plugin-rtl";
import { prefixer } from "stylis";

const createServerCache = (isRTL = false) => ({
  key: isRTL ? "pdrtl" : "pd",
  registered: Object.create(null),
  inserted: Object.create(null),
  compat: true,
  nonce: undefined,
  sheet: {
    tags: [],
    insert: () => {},
    flush: () => {},
    hydrate: () => {},
  },
  insert: (_selector, serialized) => serialized?.styles || "",
});

export function createEmotionCache(direction = "ltr") {
  const isRTL = direction === "rtl";
  if (typeof document === "undefined") {
    return createServerCache(isRTL);
  }

  return createCache({
    key: isRTL ? "pdrtl" : "pd",
    prepend: true,
    ...(isRTL ? { stylisPlugins: [prefixer, rtlPlugin] } : {}),
  });
}
