import React, { useEffect, useMemo } from "react";
import { CacheProvider } from "@emotion/react";
import { createEmotionCache } from "./emotionCache";

import { ProfileProvider } from "./components/profile/profileContext.jsx";
import App from "./App.jsx";
import CustomCursor from "./components/layout/CustomCursor.jsx";
import { useBootReady } from "./components/error/useBootReady.jsx";

function BootReadyMarker() {
  useBootReady();
  return null;
}

export default function Root({ prerender = false }) {
  const cache = useMemo(
    () => createEmotionCache(),
    [],
  );

  return (
    <CacheProvider value={cache}>
      <BootReadyMarker />
      <ProfileProvider>
        <CustomCursor />
        <App prerender={prerender} />
      </ProfileProvider>
    </CacheProvider>
  );
}
