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
        py: 2.5,
        textAlign: "center",
        borderTop: 1,
        borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)",
      }}
    >
      <Typography 
        variant="body2" 
        component="p"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.75,
          flexWrap: "wrap",
        }}
      >
        <span>Built with AI, coffee, and good vibes</span>
        <span style={{ opacity: 0.5 }}>•</span>
        <span>PaaS Deployer</span>
      </Typography>
    </Box>
  );
};

export default FooterMui;