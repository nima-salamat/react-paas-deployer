import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Outlet } from "react-router-dom";
import { Box, CssBaseline, ThemeProvider, alpha, createTheme } from "@mui/material";

import Navbar from "./components/layout/Navbar.jsx";
import Home from "./components/home/home.jsx";
import Services from "./components/service/Services.jsx";
import SigninOrSignup from "./components/signin_or_signup/signin_or_signup.jsx";
import Plans from "./components/plans/plans.jsx";
import Footer from "./components/layout/Footer.jsx";
import AboutUs from "./components/aboutUs/aboutUs.jsx";
import ServiceDetail from "./components/service_detail/ServiceDetail.jsx";
import Profile from "./components/profile/profile.jsx";
import Volumes from "./components/volumes/Volumes.jsx";
import Networks from "./components/networks/Networks.jsx";
import FloatingNav from "./components/layout/FloatingNav";
import TicketList from "./components/tickets/TicketList.jsx";
import CreateTicket from "./components/tickets/CreateTicket.jsx";
import TicketDetail from "./components/tickets/TicketDetail.jsx";
import StaffConsole from "./components/staff/StaffConsole.jsx";
import EmailManagement from "./components/emails/EmailManagement.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import { TicketNotifyProvider } from "./components/tickets/TicketNotifyContext.jsx";
import MessengerApp from "./components/messenger/MessengerApp.jsx";

const THEME_STORAGE_KEY = "paas-theme-mode";
const allowedThemeModes = new Set(["light", "dark", "system"]);

const normalizeThemeMode = (value) => (allowedThemeModes.has(value) ? value : null);

const getInitialThemeMode = () => {
  if (typeof window === "undefined") return "system";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return normalizeThemeMode(stored) || "system";
  } catch {
    return "system";
  }
};

const getSystemTheme = () => {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const Layout = ({ themeMode, setThemeMode }) => {
  const loggedIn = typeof window !== "undefined" && Boolean(window.localStorage.getItem("access"));

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        minWidth: 0,
        overflowX: "hidden",
        bgcolor: "background.default",
        color: "text.primary",
      }}
    >
      <Navbar themeMode={themeMode} onThemeModeChange={setThemeMode} />

      <Box component="main" sx={{ flex: 1, minHeight: 0, width: "100%" }}>
        <Outlet />
      </Box>

      <Footer />
      <FloatingNav loggedIn={loggedIn} />
    </Box>
  );
};

function App() {
  const [themeMode, setThemeMode] = useState(getInitialThemeMode);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // localStorage may be unavailable in some environments; fail silently.
    }
  }, [themeMode]);

  const resolvedMode = themeMode === "system" ? systemTheme : themeMode;

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
  }, [resolvedMode]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");

    updateSystemTheme();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateSystemTheme);
      return () => mediaQuery.removeEventListener("change", updateSystemTheme);
    }

    mediaQuery.addListener(updateSystemTheme);
    return () => mediaQuery.removeListener(updateSystemTheme);
  }, []);

  const appTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: {
            main: resolvedMode === "dark" ? "#8ab4ff" : "#2f66ff",
          },
          secondary: {
            main: resolvedMode === "dark" ? "#b08cff" : "#6d5efc",
          },
          background: {
            default: resolvedMode === "dark" ? "#0b1020" : "#f7f9fc",
            paper: resolvedMode === "dark" ? "#111827" : "#ffffff",
          },
          divider: alpha(resolvedMode === "dark" ? "#ffffff" : "#0f172a", 0.08),
        },
        shape: {
          borderRadius: 16,
        },
        typography: {
          fontFamily:
            '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          button: {
            textTransform: "none",
            fontWeight: 600,
          },
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                transition: "background-color 180ms ease, color 180ms ease",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 14,
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
        },
      }),
    [resolvedMode]
  );

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline enableColorScheme />
      <TicketNotifyProvider>
      <Router>
        <Routes>
          <Route path="/messenger" element={<MessengerApp />} />
          <Route path="/messenger/*" element={<MessengerApp />} />
          {/* Standalone admin console — no main Navbar / Footer (messenger-style) */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/*" element={<AdminDashboard />} />
          <Route path="/" element={<Layout themeMode={themeMode} setThemeMode={setThemeMode} />}>
            <Route index element={<Home />} />
            <Route path="services" element={<Services />} />
            <Route path="volumes" element={<Volumes />} />
            <Route path="networks" element={<Networks />} />
            <Route path="plans" element={<Plans />} />
            <Route path="signin_or_signup" element={<SigninOrSignup />} />
            <Route path="aboutUs" element={<AboutUs />} />
            <Route path="profile" element={<Profile />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/new" element={<CreateTicket />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
            <Route path="staff" element={<StaffConsole />} />
            <Route path="staff/tickets" element={<StaffConsole />} />
            <Route path="admin/emails" element={<EmailManagement />} />
            <Route path="service/:id" element={<ServiceDetail />} />
          </Route>
        </Routes>
      </Router>
      </TicketNotifyProvider>
    </ThemeProvider>
  );
}

export default App;