import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  Routes,
  Route,
  Outlet,
  Navigate,
  useLocation,
  useNavigationType,
  useParams,
} from "react-router-dom";
import {
  Box,
  CssBaseline,
  ThemeProvider,
  alpha,
  createTheme,
} from "@mui/material";

import SEO from "./components/seo/SEO.jsx";

import Navbar from "./components/layout/Navbar.jsx";
import Home from "./components/home/home.jsx";
const Services = lazy(() => import("./components/service/Services.jsx"));
const Dashboard = lazy(() => import("./components/dashboard/Dashboard.jsx"));
import SigninOrSignup from "./components/signin_or_signup/signin_or_signup.jsx";
import Plans from "./components/plans/plans.jsx";
import Footer from "./components/layout/Footer.jsx";
import AboutUs from "./components/aboutUs/aboutUs.jsx";
const ServiceDetail = lazy(() => import("./components/service_detail/ServiceDetail.jsx"));
const Profile = lazy(() => import("./components/profile/profile.jsx"));
const Volumes = lazy(() => import("./components/volumes/Volumes.jsx"));
const Networks = lazy(() => import("./components/networks/Networks.jsx"));
import FloatingNav from "./components/layout/FloatingNav";
import NotFound from "./components/not_found/NotFound.jsx";
const DocsHome = lazy(() => import("./components/docs/DocsHome.jsx"));

const TicketList = lazy(() => import("./components/tickets/TicketList.jsx"));
const CreateTicket = lazy(() => import("./components/tickets/CreateTicket.jsx"));
const TicketDetail = lazy(() => import("./components/tickets/TicketDetail.jsx"));
const StaffConsole = lazy(() => import("./components/staff/StaffConsole.jsx"));
const EmailManagement = lazy(() => import("./components/emails/EmailManagement.jsx"));
const AdminDashboard = lazy(() => import("./components/admin/AdminDashboard.jsx"));

import { TicketNotifyProvider } from "./components/tickets/TicketNotifyContext.jsx";
const MessengerApp = lazy(() => import("./components/messenger/MessengerApp.jsx"));

import { HelmetProvider } from "react-helmet-async";

const THEME_STORAGE_KEY = "paas-theme-mode";

const allowedThemeModes = new Set([
  "light",
  "dark",
  "system",
]);

const normalizeThemeMode = (value) =>
  allowedThemeModes.has(value) ? value : null;

const getInitialThemeMode = () => {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const stored = window.localStorage.getItem(
      THEME_STORAGE_KEY
    );

    return normalizeThemeMode(stored) || "system";
  } catch {
    return "system";
  }
};

const getSystemTheme = () => {
  if (
    typeof window === "undefined" ||
    !window.matchMedia
  ) {
    return "light";
  }

  return window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches
    ? "dark"
    : "light";
};

function LegacyServiceRedirect() {
  const { id } = useParams();
  return <Navigate to={`/dashboard/services/${id}`} replace />;
}

function TicketDetailRedirect() {
  const { id } = useParams();
  return <Navigate to={`/dashboard/tickets/${id}`} replace />;
}

function RouteScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Preserve browser history restoration for Back/Forward, but never carry a
    // previous page's scroll position into a new route pushed by the app.
    if (navigationType === "POP" || location.hash) return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [location.pathname, location.hash, navigationType]);

  return null;
}

const Layout = ({
  themeMode,
  setThemeMode,
}) => {
  const location = useLocation();
  const isDashboardSpace =
    location.pathname === "/dashboard" ||
    location.pathname.startsWith("/dashboard/") ||
    location.pathname.startsWith("/service/") ||
    location.pathname.startsWith("/services/");
  const loggedIn =
    typeof window !== "undefined" &&
    Boolean(
      window.localStorage.getItem("access")
    );

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
      {!isDashboardSpace && (
        <Navbar
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
        />
      )}

      <Box
        component="main"
        sx={{
          flex: 1,
          minHeight: 0,
          width: "100%",
        }}
      >
        <Outlet />
      </Box>

      {!isDashboardSpace && <Footer />}

      {!isDashboardSpace && (
        <FloatingNav
          loggedIn={loggedIn}
        />
      )}
    </Box>
  );
};

export function App() {
  const [themeMode, setThemeMode] = useState(
    getInitialThemeMode
  );

  const [systemTheme, setSystemTheme] = useState(
    getSystemTheme
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        themeMode
      );
    } catch {
      // Ignore localStorage errors.
    }
  }, [themeMode]);

  const resolvedMode =
    themeMode === "system"
      ? systemTheme
      : themeMode;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.theme =
      resolvedMode;

    document.documentElement.style.colorScheme =
      resolvedMode;
  }, [resolvedMode]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia
    ) {
      return undefined;
    }

    const mediaQuery =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      );

    const updateSystemTheme = () => {
      setSystemTheme(
        mediaQuery.matches
          ? "dark"
          : "light"
      );
    };

    updateSystemTheme();

    if (
      typeof mediaQuery.addEventListener ===
      "function"
    ) {
      mediaQuery.addEventListener(
        "change",
        updateSystemTheme
      );

      return () => {
        mediaQuery.removeEventListener(
          "change",
          updateSystemTheme
        );
      };
    }

    mediaQuery.addListener(
      updateSystemTheme
    );

    return () => {
      mediaQuery.removeListener(
        updateSystemTheme
      );
    };
  }, []);

  const appTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,

          primary: {
            main:
              resolvedMode === "dark"
                ? "#8ab4ff"
                : "#2f66ff",
          },

          secondary: {
            main:
              resolvedMode === "dark"
                ? "#b08cff"
                : "#6d5efc",
          },

          background: {
            default:
              resolvedMode === "dark"
                ? "#0b1020"
                : "#f7f9fc",

            paper:
              resolvedMode === "dark"
                ? "#111827"
                : "#ffffff",
          },

          divider: alpha(
            resolvedMode === "dark"
              ? "#ffffff"
              : "#0f172a",
            0.08
          ),
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
                transition:
                  "background-color 180ms ease, color 180ms ease",
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
    <HelmetProvider>
      <ThemeProvider theme={appTheme}>
        <CssBaseline enableColorScheme />

        <TicketNotifyProvider>
          <RouteScrollManager />
          <SEO />

          <Suspense
            fallback={
              <Box
                sx={{
                  minHeight: "40vh",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "text.secondary",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Loading…
              </Box>
            }
          >
            <Routes>
              {/* Public SEO pages */}

            <Route
              path="/"
              element={
                <Layout
                  themeMode={themeMode}
                  setThemeMode={
                    setThemeMode
                  }
                />
              }
            >
              <Route
                index
                element={<Home />}
              />

              <Route path="dashboard" element={<Dashboard />}>
                <Route index element={<Navigate to="services" replace />} />
                <Route path="services" element={<Services />} />
                <Route path="networks" element={<Networks />} />
                <Route path="volumes" element={<Volumes />} />
                <Route path="plans" element={<Plans />} />
                <Route path="tickets" element={<TicketList />} />
                <Route path="tickets/new" element={<CreateTicket />} />
                <Route path="tickets/:id" element={<TicketDetail />} />
                <Route path="profile" element={<Profile embedded />} />
              </Route>

              {/* Service detail keeps its own chrome (outside the list shell) */}
              <Route path="dashboard/service/:id" element={<LegacyServiceRedirect />} />
              <Route path="dashboard/services/:id" element={<ServiceDetail />} />

              <Route
                path="services"
                element={<Navigate to="/dashboard/services" replace />}
              />
              <Route path="services/:id" element={<LegacyServiceRedirect />} />
              <Route path="service/:id" element={<LegacyServiceRedirect />} />
              <Route path="service_detail/:id" element={<LegacyServiceRedirect />} />
              <Route path="volumes" element={<Navigate to="/dashboard/volumes" replace />} />
              <Route path="networks" element={<Navigate to="/dashboard/networks" replace />} />
              <Route path="plans" element={<Navigate to="/dashboard/plans" replace />} />
              <Route path="tickets" element={<Navigate to="/dashboard/tickets" replace />} />
              <Route path="tickets/new" element={<Navigate to="/dashboard/tickets/new" replace />} />
              <Route path="tickets/:id" element={<TicketDetailRedirect />} />
              <Route path="profile" element={<Navigate to="/dashboard/profile" replace />} />

              <Route path="signin_or_signup" element={<SigninOrSignup />} />
              <Route path="aboutUs" element={<AboutUs />} />

              <Route path="staff" element={<StaffConsole />} />
              <Route path="staff/tickets" element={<StaffConsole />} />
              <Route path="admin/emails" element={<EmailManagement />} />
            </Route>

            {/* Documentation workspace — intentionally outside the public site layout */}
            <Route path="/docs" element={<DocsHome />} />
            <Route path="/docs/:slug" element={<DocsHome />} />

            {/* Messenger */}

            <Route
              path="/messenger"
              element={
                <MessengerApp
                  themeMode={themeMode}
                  onThemeModeChange={
                    setThemeMode
                  }
                />
              }
            />

            <Route
              path="/messenger/*"
              element={
                <MessengerApp
                  themeMode={themeMode}
                  onThemeModeChange={
                    setThemeMode
                  }
                />
              }
            />

            {/* Admin */}

            <Route
              path="/admin"
              element={<AdminDashboard />}
            />

            <Route
              path="/admin/*"
              element={<AdminDashboard />}
            />

            <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </TicketNotifyProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;