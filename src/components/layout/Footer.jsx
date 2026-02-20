// components/layout/FooterMui.jsx
import React from "react";
import { Box, Typography, useTheme } from "@mui/material";

const FooterMui = () => {
  const theme = useTheme();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
        color: theme.palette.text.secondary,
        py: 2,
        textAlign: "center",
        // optional: keep a subtle top border to separate from content
        borderTop: 1,
        borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
      }}
    >
      <Typography variant="body2" component="small">
        © 2026 PAAS Deployer
      </Typography>
    </Box>
  );
};

export default FooterMui;
