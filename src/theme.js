// theme.js
import { createTheme, alpha } from "@mui/material/styles";

export const getTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === "light"
        ? {
            background: { default: "#eef3f8", paper: "#ffffff" },
            text: { primary: "#111827", secondary: "#555" },
            primary: { main: "#3b82f6" },
          }
        : {
            background: { default: "#0b1220", paper: "#111827" },
            text: { primary: "#e5e7eb", secondary: "#9ca3af" },
            primary: { main: "#60a5fa" },
          }),
    },
    shape: { borderRadius: 14 },
    typography: { fontFamily: "Segoe UI, sans-serif" },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          /* Scrollbar for Webkit browsers */
          "::-webkit-scrollbar": {
            width: "10px",
            height: "10px",
          },
          "::-webkit-scrollbar-track": {
            backgroundColor:
              mode === "light"
                ? alpha("#000", 0.03)
                : alpha("#fff", 0.08),
            borderRadius: "10px",
          },
          "::-webkit-scrollbar-thumb": {
            backgroundColor:
              mode === "light"
                ? alpha("#3b82f6", 0.6)
                : alpha("#60a5fa", 0.6),
            borderRadius: "10px",
            border: `2px solid ${
              mode === "light" ? alpha("#000", 0.03) : alpha("#fff", 0.08)
            }`,
          },
          "::-webkit-scrollbar-thumb:hover": {
            backgroundColor:
              mode === "light"
                ? alpha("#3b82f6", 0.85)
                : alpha("#60a5fa", 0.85),
          },

          /* Scrollbar for Firefox */
          "*": {
            scrollbarWidth: "thin",
            scrollbarColor:
              mode === "light"
                ? `${alpha("#3b82f6", 0.6)} ${alpha("#000", 0.03)}`
                : `${alpha("#60a5fa", 0.6)} ${alpha("#fff", 0.08)}`,
          },
        },
      },
    },
  });

export default getTheme;
