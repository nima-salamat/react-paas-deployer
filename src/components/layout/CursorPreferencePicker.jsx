import React, { useEffect, useState } from "react";
import { Box, ButtonBase, Paper, Typography } from "@mui/material";
import NearMeIcon from "@mui/icons-material/NearMe";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import {
  CURSOR_OPTIONS,
  CURSOR_STORAGE_KEY,
  normalizeCursorPreference,
  readCursorPreference,
  writeCursorPreference,
} from "./cursorSettings";

export default function CursorPreferencePicker({ compact = false }) {
  const [cursorPreference, setCursorPreference] = useState(() => readCursorPreference());

  useEffect(() => {
    const syncFromPreferenceEvent = (event) => {
      setCursorPreference(normalizeCursorPreference(event?.detail ?? readCursorPreference()));
    };
    const syncFromStorage = (event) => {
      if (!event?.key || event.key === CURSOR_STORAGE_KEY) {
        setCursorPreference(readCursorPreference());
      }
    };
    window.addEventListener("paasdeployer:cursor-preference", syncFromPreferenceEvent);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener("paasdeployer:cursor-preference", syncFromPreferenceEvent);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: compact
            ? { xs: "repeat(2, minmax(0, 1fr))" }
            : { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" },
          gap: compact ? 1 : 1.25,
        }}
      >
        {CURSOR_OPTIONS.map((option) => {
          const selected = cursorPreference === option.id;
          return (
            <ButtonBase
              key={option.id}
              onClick={() => setCursorPreference(writeCursorPreference(option.id))}
              aria-label={option.label}
              aria-pressed={selected}
              sx={{ display: "block", width: "100%", borderRadius: 2, textAlign: "left" }}
            >
              <Paper
                variant="outlined"
                sx={{
                  width: "100%",
                  height: "100%",
                  minHeight: compact ? 126 : 158,
                  p: compact ? 1 : 1.25,
                  borderRadius: 2,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? "primary.main" : "divider",
                  bgcolor: selected ? "action.selected" : "background.paper",
                  transition: "border-color 160ms ease, background-color 160ms ease, transform 160ms ease",
                  "&:hover": { borderColor: "primary.main", transform: "translateY(-1px)" },
                }}
              >
                <Box
                  sx={{
                    height: compact ? 54 : 76,
                    mb: compact ? 0.8 : 1.1,
                    borderRadius: 1.5,
                    display: "grid",
                    placeItems: "center",
                    position: "relative",
                    overflow: "hidden",
                    bgcolor: (theme) => theme.palette.mode === "dark" ? "#0b1220" : "#eef2f7",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {option.id === "custom" ? (
                    <Box
                      sx={{
                        width: compact ? 26 : 32,
                        height: compact ? 26 : 32,
                        border: "1.5px solid",
                        borderColor: (theme) => theme.palette.mode === "dark" ? "#f8fafc" : "#334155",
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        boxShadow: "0 0 0 5px rgba(148,163,184,.10)",
                      }}
                    >
                      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: (theme) => theme.palette.mode === "dark" ? "#f8fafc" : "#334155" }} />
                    </Box>
                  ) : option.id === "dot" ? (
                    <Box
                      sx={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        bgcolor: (theme) => theme.palette.mode === "dark" ? "#f8fafc" : "#334155",
                        boxShadow: "0 0 0 7px rgba(148,163,184,.16)",
                      }}
                    />
                  ) : option.id === "crosshair" ? (
                    <GpsFixedIcon sx={{ fontSize: compact ? 28 : 34, color: (theme) => theme.palette.mode === "dark" ? "#f8fafc" : "#334155" }} />
                  ) : (
                    <NearMeIcon sx={{ fontSize: compact ? 28 : 34, color: (theme) => theme.palette.mode === "dark" ? "#f8fafc" : "#334155", transform: "rotate(-12deg)" }} />
                  )}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
                  {option.label}
                </Typography>
                <Typography
                  variant="caption"
                  color={selected ? "primary.main" : "text.secondary"}
                  sx={{ display: "block", mt: 0.65, lineHeight: 1.35 }}
                >
                  {selected ? "Selected" : "Choose cursor"}
                </Typography>
              </Paper>
            </ButtonBase>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25, lineHeight: 1.5 }}>
        {CURSOR_OPTIONS.find((option) => option.id === cursorPreference)?.description}
        {" "}Your choice is applied immediately and saved in this browser.
      </Typography>
    </>
  );
}
