import React, { useMemo, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, Stack,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { formatDay } from "../messengerUtils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function dayKey(d) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * Custom circular calendar — days that have messages are highlighted & clickable.
 */
export default function DayJumpDialog({
  open,
  onClose,
  messagesWithDays = [],
  messages = [],
  onJumpToDay,
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const messageDays = useMemo(() => {
    const map = new Map();
    for (const m of messages || []) {
      if (!m?.created_at) continue;
      const dt = new Date(m.created_at);
      if (Number.isNaN(dt.getTime())) continue;
      const key = dayKey(dt);
      if (!map.has(key)) {
        map.set(key, {
          label: formatDay(m.created_at),
          id: `day-${formatDay(m.created_at)}-${m.id}`,
          date: dt,
        });
      }
    }
    for (const d of (messagesWithDays || []).filter((x) => x.type === "day")) {
      for (const [k, v] of map.entries()) {
        if (v.label === d.label) {
          map.set(k, { ...v, id: d.id, label: d.label });
        }
      }
    }
    return map;
  }, [messages, messagesWithDays]);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const total = daysInMonth(cursor);
    const startPad = first.getDay();
    const out = [];
    for (let i = 0; i < startPad; i += 1) out.push(null);
    for (let day = 1; day <= total; day += 1) {
      out.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString([], { month: "long", year: "numeric" });
  const today = new Date();

  const onPick = (dt) => {
    if (!dt) return;
    const info = messageDays.get(dayKey(dt));
    if (!info) return;
    onClose?.();
    requestAnimationFrame(() => {
      onJumpToDay?.({
        id: info.id,
        label: info.label,
        date: dt,
      });
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>Jump to day</DialogTitle>
      <DialogContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <IconButton
            size="small"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography fontWeight={700}>{monthLabel}</Typography>
          <IconButton
            size="small"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            <ChevronRightIcon />
          </IconButton>
        </Stack>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: 0.75 }}>
          {WEEKDAYS.map((w) => (
            <Box
              key={w}
              sx={{
                width: 36, height: 36, mx: "auto", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                typography: "caption", fontWeight: 700, color: "text.secondary", bgcolor: "action.hover",
              }}
            >
              {w}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5 }}>
          {cells.map((dt, i) => {
            if (!dt) {
              return <Box key={`e-${i}`} sx={{ width: 36, height: 36, mx: "auto" }} />;
            }
            const key = dayKey(dt);
            const hasMsg = messageDays.has(key);
            const isToday = sameDay(dt, today);
            return (
              <Box
                key={key}
                component="button"
                type="button"
                disabled={!hasMsg}
                onClick={() => onPick(dt)}
                title={hasMsg ? messageDays.get(key)?.label : undefined}
                sx={{
                  width: 36, height: 36, mx: "auto", p: 0,
                  border: isToday ? "2px solid" : "1px solid",
                  borderColor: isToday ? "primary.main" : hasMsg ? "primary.light" : "transparent",
                  borderRadius: "50%",
                  bgcolor: hasMsg
                    ? (t) => t.palette.mode === "dark" ? "rgba(25,118,210,0.35)" : "rgba(25,118,210,0.18)"
                    : "transparent",
                  color: hasMsg ? "primary.main" : "text.disabled",
                  fontWeight: hasMsg ? 800 : 500,
                  fontSize: 13,
                  cursor: hasMsg ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "transform 0.12s, background-color 0.12s",
                  "&:hover": hasMsg
                    ? {
                        transform: "scale(1.08)",
                        bgcolor: (t) => t.palette.mode === "dark" ? "rgba(25,118,210,0.5)" : "rgba(25,118,210,0.28)",
                      }
                    : undefined,
                }}
              >
                {dt.getDate()}
              </Box>
            );
          })}
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, textAlign: "center" }}>
          Blue days have messages — tap to jump.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
