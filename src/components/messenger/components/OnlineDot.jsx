import React from "react";
import { Box } from "@mui/material";

/**
 * Small green dot overlaid on the bottom-right of an avatar to indicate
 * the user is online. Place inside a `position: relative` parent.
 *
 * Props:
 *  - size: number (default 12) — diameter of the dot
 *  - bottom: number (default 0)
 *  - right: number (default 0)
 */
export default function OnlineDot({ size = 12, bottom = 0, right = 0 }) {
  return (
    <Box
      sx={{
        position: "absolute",
        bottom,
        right,
        width: size,
        height: size,
        borderRadius: "50%",
        bgcolor: "#4caf50",
        border: "2px solid",
        borderColor: "background.paper",
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
}
