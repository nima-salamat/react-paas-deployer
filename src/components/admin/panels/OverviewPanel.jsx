import React, { useMemo } from "react";
import {
  Box, Chip, Grid, Paper, Stack, Typography, Divider, alpha, useTheme,
} from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import {
  hasAnyRule, hasRule, getSessionRules, isSessionSuperuser,
  resolveThemeColor,
} from "../adminUtils";
import StatCard from "../components/StatCard";

/**
 * Personalised overview shown on the dashboard landing tab.
 * Always shows identity + permissions; conditionally shows ticket stats
 * and recent activity.
 */
export default function OverviewPanel({
  me,
  stats,
  liveConnected,
  liveEvents = [],
  tickets = [],
  tLoading,
  onOpenTicket,
}) {
  useTheme(); // keep theme hook stable for future styling
  const rules = useMemo(() => getSessionRules(), []);
  const superuser = isSessionSuperuser();
  const canTickets = hasAnyRule("tickets.view") || hasAnyRule("tickets.manage");
  const canServices = hasAnyRule("services.view") || hasAnyRule("services.manage");
  const canUsers = hasAnyRule("users.view") || hasAnyRule("users.manage");
  const canPlans = hasAnyRule("plans.view") || hasAnyRule("plans.manage");
  const canLogin = hasAnyRule("login_settings.view") || hasAnyRule("login_settings.manage");

  const accessible = [
    canTickets && "Tickets",
    canServices && "Services",
    canUsers && "Users",
    canPlans && "Plans",
    canLogin && "Login settings",
    hasRule("invites.manage") && "Invites",
    (hasAnyRule("auth_codes.view") || hasAnyRule("auth_codes.manage")) && "Auth codes",
    hasRule("emails.manage") && "Email",
    (hasAnyRule("tables.view") || hasAnyRule("tables.manage")) && "DB tables",
  ].filter(Boolean);

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" fontWeight={800}>Overview</Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back, <strong>{me?.username || "Admin"}</strong> — here's what's happening.
          </Typography>
        </Box>
        <Chip
          size="small"
          icon={<FiberManualRecordIcon sx={{ fontSize: 12 }} />}
          label={liveConnected ? "Realtime connected" : "Realtime offline"}
          color={liveConnected ? "success" : "default"}
          variant="outlined"
        />
      </Stack>

      {/* Identity card — always shown */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="overline" color="text.secondary">Signed in as</Typography>
        <Typography variant="h6" fontWeight={800}>
          {me?.username || "—"}
          {superuser && <Chip size="small" color="error" label="superuser" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
          {!superuser && me?.is_staff && <Chip size="small" color="primary" label="staff" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
        </Typography>
        {me?.email && (
          <Typography variant="body2" color="text.secondary">{me.email}</Typography>
        )}
        <Divider sx={{ my: 1.5 }} />
        <Typography variant="subtitle2" gutterBottom>Your permissions</Typography>
        {superuser ? (
          <Typography variant="body2" color="text.secondary">
            Superuser — full access to every section.
          </Typography>
        ) : rules.length === 0 ? (
          <Typography variant="body2" color="warning.main">
            No rules assigned. Ask a superuser to grant access.
          </Typography>
        ) : (
          <Stack direction="row" gap={0.5} flexWrap="wrap" useFlexGap>
            {rules.map((r) => (
              <Chip key={r} size="small" variant="outlined" label={r} sx={{ fontFamily: "monospace", fontSize: 11, height: 20 }} />
            ))}
          </Stack>
        )}
        {accessible.length > 0 && (
          <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
            You can open: {accessible.join(" · ")}
          </Typography>
        )}
      </Paper>

      {/* Ticket stats — only with tickets.view */}
      {canTickets && stats && (
        <Grid container spacing={2}>
          {[
            { label: "Total", value: stats.total, color: "primary.main" },
            { label: "Open", value: stats.open, color: "info.main" },
            { label: "In Progress", value: stats.in_progress, color: "warning.main" },
            { label: "Waiting", value: stats.waiting_user, color: "secondary.main" },
            { label: "Urgent", value: stats.urgent, color: "error.main" },
            { label: "Unassigned", value: stats.unassigned, color: "text.primary" },
          ].map((s) => (
            <Grid key={s.label} size={{ xs: 6, sm: 4, md: 2 }}>
              <StatCard label={s.label} value={s.value} color={s.color} />
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={2}>
        {canTickets && (
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography fontWeight={700}>Recent tickets</Typography>
                {onOpenTicket && (
                  <Chip size="small" variant="outlined" label={`${tickets.length} shown`} />
                )}
              </Stack>
              {tLoading ? (
                <Typography variant="body2" color="text.secondary">Loading…</Typography>
              ) : tickets.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No tickets</Typography>
              ) : (
                <Stack gap={1}>
                  {tickets.slice(0, 8).map((t) => (
                    <Paper
                      key={t.id}
                      variant="outlined"
                      sx={{
                        p: 1.25,
                        cursor: onOpenTicket ? "pointer" : "default",
                        transition: "background-color .12s ease",
                        "&:hover": onOpenTicket ? { bgcolor: "action.hover" } : undefined,
                      }}
                      onClick={() => onOpenTicket?.(t.id)}
                    >
                      <Stack direction="row" justifyContent="space-between" gap={1}>
                        <Typography fontWeight={600} fontSize={14} noWrap>{t.subject}</Typography>
                        <Chip size="small" label={t.status} sx={{ height: 20, fontSize: 11 }} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {t.public_id} · {t.user?.username}
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid>
        )}

        <Grid size={{ xs: 12, md: canTickets ? 5 : 12 }}>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: "auto" }}>
            <Typography fontWeight={700} mb={1.5}>Live activity</Typography>
            {liveEvents.length === 0 ? (
              <Stack alignItems="center" py={4} gap={1}>
                <FiberManualRecordIcon color="disabled" />
                <Typography variant="body2" color="text.secondary">Waiting for events…</Typography>
              </Stack>
            ) : (
              <Stack spacing={1}>
                {liveEvents.map((ev, i) => (
                  <Paper key={i} variant="outlined" sx={{ p: 1.25, borderColor: (t) => alpha(resolveThemeColor(t, "primary.main"), 0.15) }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                      <Chip size="small" label={ev.type} sx={{ height: 20, fontSize: 11 }} />
                      {ev.public_id && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                          {ev.public_id}
                        </Typography>
                      )}
                    </Stack>
                    {ev.subject && (
                      <Typography variant="body2" mt={0.5} noWrap>{ev.subject}</Typography>
                    )}
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
