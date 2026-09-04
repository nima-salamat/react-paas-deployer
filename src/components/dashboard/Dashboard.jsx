import React, { useState } from "react";
import { Box } from "@mui/material";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import DashboardNavbar from "./DashboardNavbar.jsx";
import DashboardSidebar, { SIDEBAR_WIDTH } from "./DashboardSidebar.jsx";

/**
 * Dashboard shell: shared navbar + sidebar. Child routes render in the content area.
 * Service detail is intentionally outside this layout (has its own chrome).
 */
export default function Dashboard() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Legacy: /dashboard?tab=services|networks|volumes → path routes
  const tab = new URLSearchParams(location.search).get("tab");
  if (location.pathname === "/dashboard" && tab) {
    const allowed = new Set(["services", "networks", "volumes"]);
    if (allowed.has(tab)) {
      return <Navigate to={`/dashboard/${tab}`} replace />;
    }
  }
  if (location.pathname === "/dashboard") {
    return <Navigate to="/dashboard/services" replace />;
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <DashboardNavbar onMenuClick={() => setMobileOpen(true)} />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          width: "100%",
        }}
      >
        <DashboardSidebar
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            width: { xs: "100%", md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
            maxWidth: { md: `calc(100% - ${SIDEBAR_WIDTH}px)` },
          }}
        >
          <Box
            sx={{
              width: "100%",
              maxWidth: 1480,
              mx: "auto",
              px: { xs: 0, sm: 1.5, md: 2.5 },
              py: { xs: 0, sm: 1.5, md: 2.5 },
            }}
          >
            <Box
              sx={{
                width: "100%",
                minHeight: {
                  xs: "calc(100dvh - 56px)",
                  sm: "calc(100vh - 72px)",
                },
                border: { xs: "none", sm: "1px solid" },
                borderColor: "divider",
                borderRadius: { xs: 0, sm: 3 },
                overflow: "hidden",
                bgcolor: "background.paper",
                boxShadow: {
                  xs: "none",
                  sm: "0 8px 30px rgba(15, 23, 42, 0.05)",
                },
              }}
            >
              <Outlet />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
