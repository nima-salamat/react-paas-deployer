import React from "react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

import { ProfileProvider } from "./components/profile/profile.jsx";
import App from "./App.jsx";
import CustomCursor from "./components/layout/CustomCursor.jsx";

export function createEmotionCache() {
  return createCache({
    key: "pd",
    prepend: true,
  });
}

export default function Root({ emotionCache = null }) {
  const cache = emotionCache || createEmotionCache();

  return (
    <CacheProvider value={cache}>
      <ProfileProvider>
        <CustomCursor />
        <App />
      </ProfileProvider>
    </CacheProvider>
  );
}
