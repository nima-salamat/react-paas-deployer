import React from "react";
import Box from "@mui/material/Box";
import { LuHardDrive } from "react-icons/lu";

/** Shared volume glyph for dashboard navigation and resource-management pages. */
export default function VolumeIcon({ fontSize = "medium", size, sx, ...props }) {
  const iconSize = size ?? (fontSize === "small" ? 18 : fontSize === "large" ? 24 : 20);
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        lineHeight: 0,
        fontSize: iconSize,
        ...sx,
      }}
    >
      <LuHardDrive size="1em" {...props} />
    </Box>
  );
}
