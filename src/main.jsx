// main.jsx
import React, { useMemo, useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import { ThemeProvider, CssBaseline } from "@mui/material";
import { getTheme } from "./theme";
import { ProfileProvider } from "./components/profile/profile.jsx";
function Root() {
  // read saved preference from localStorage, fall back to OS preference, then "light"
  const initialMode = (() => {
    try {
      const saved = localStorage.getItem("themeMode");
      if (saved === "light" || saved === "dark") return saved;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    } catch (e) {
      /* ignore (e.g. SSR or blocked storage) */
    }
    return "light";
  })();

  const [mode, setMode] = useState(initialMode);

  // persist to localStorage when mode changes
  useEffect(() => {
    try {
      localStorage.setItem("themeMode", mode);
    } catch (e) {
      /* ignore storage errors */
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((m) => (m === "light" ? "dark" : "light"));
  }, []);

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* pass both toggleTheme and themeMode */}
      <ProfileProvider>
        <App toggleTheme={toggleTheme} themeMode={mode} />
      </ProfileProvider>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
