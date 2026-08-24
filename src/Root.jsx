import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
} from "react";

import {
  ThemeProvider,
  CssBaseline,
} from "@mui/material";

import { CacheProvider } from "@emotion/react";
import { createEmotionCache } from "./emotionCache";

import { getTheme } from "./theme";
import { ProfileProvider } from "./components/profile/profile.jsx";
import App from "./App.jsx";

export default function Root() {
  const initialMode = (() => {
    if (typeof window === "undefined") {
      return "light";
    }

    try {
      const saved =
        window.localStorage.getItem("themeMode");

      if (saved === "light" || saved === "dark") {
        return saved;
      }

      if (
        window.matchMedia &&
        window.matchMedia(
          "(prefers-color-scheme: dark)"
        ).matches
      ) {
        return "dark";
      }
    } catch {
      // Ignore unavailable browser APIs.
    }

    return "light";
  })();

  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "themeMode",
        mode
      );
    } catch {
      // Ignore storage errors.
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((current) =>
      current === "light" ? "dark" : "light"
    );
  }, []);

  const theme = useMemo(
    () => getTheme(mode),
    [mode]
  );

  const emotionCache = useMemo(
    () => createEmotionCache(),
    []
  );

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <ProfileProvider>
          <App
            toggleTheme={toggleTheme}
            themeMode={mode}
          />
        </ProfileProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}