import createCache from "@emotion/cache";

const createServerCache = () => {
  const cache = {
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
    insert: (_selector, serialized) => {
      if (serialized?.name && typeof serialized.styles === "string") {
        cache.inserted[serialized.name] = serialized.styles;
      }
      return serialized?.styles || "";
    },
  };
  return cache;
};

export function getEmotionStyleTags(cache) {
  if (!cache?.inserted) return "";
  return Object.entries(cache.inserted)
    .filter(([, css]) => typeof css === "string" && css.length > 0)
    .map(
      ([name, css]) =>
        `<style data-emotion="${cache.key} ${name}">${css}</style>`,
    )
    .join("");
}

export function createEmotionCache() {
  if (typeof document === "undefined") {
    return createServerCache();
  }

  return createCache({
    key: "pd",
    prepend: true,
  });
}
