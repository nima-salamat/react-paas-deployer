import React, { useMemo } from "react";
import { CacheProvider } from "@emotion/react";
import { createEmotionCache } from "./emotionCache";

import { ProfileProvider } from "./components/profile/profileContext.jsx";
import { LocaleProvider, useLocale } from "./i18n/LocaleProvider.jsx";
import App from "./App.jsx";
import CustomCursor from "./components/layout/CustomCursor.jsx";
import { useBootReady } from "./components/error/useBootReady.jsx";

function BootReadyMarker() {
  useBootReady();
  return null;
}

function DirectionalCacheProvider({ children }) {
  const { isRTL } = useLocale();
  // Keep one cache per direction. Recreating the same key after each language
  // toggle can duplicate Emotion style tags and inject repeated CSS.
  const caches = useMemo(() => ({
    ltr: createEmotionCache("ltr"),
    rtl: createEmotionCache("rtl"),
  }), []);
  return <CacheProvider value={isRTL ? caches.rtl : caches.ltr}>{children}</CacheProvider>;
}

export default function Root({ prerender = false }) {
  return (
    <LocaleProvider>
      <DirectionalCacheProvider>
        <BootReadyMarker />
        <ProfileProvider>
          <CustomCursor />
          <App prerender={prerender} />
        </ProfileProvider>
      </DirectionalCacheProvider>
    </LocaleProvider>
  );
}
