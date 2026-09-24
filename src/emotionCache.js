import createCache from "@emotion/cache";

const createServerCache = () => ({
  key: "pd",
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

export function createEmotionCache() {
  if (typeof document === "undefined") {
    return createServerCache();
  }

  return createCache({
    key: "pd",
    prepend: true,
  });
}
