import React from "react";
import { Helmet } from "react-helmet-async";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>404 — Page Not Found | PassDeployer</title>
        <meta
          name="description"
          content="The page you are looking for could not be found."
        />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 2,
          py: 6,
          overflow: "hidden",
          position: "relative",
          bgcolor: "background.default",
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            width: { xs: 260, md: 420 },
            height: { xs: 260, md: 420 },
            borderRadius: "50%",
            top: { xs: -100, md: -150 },
            right: { xs: -100, md: -120 },
            background:
              "radial-gradient(circle, rgba(47,102,255,0.16) 0%, rgba(47,102,255,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <Box
          aria-hidden="true"
          sx={{
            position: "absolute",
            width: { xs: 220, md: 340 },
            height: { xs: 220, md: 340 },
            borderRadius: "50%",
            bottom: { xs: -100, md: -120 },
            left: { xs: -90, md: -100 },
            background:
              "radial-gradient(circle, rgba(109,94,252,0.13) 0%, rgba(109,94,252,0) 70%)",
            pointerEvents: "none",
          }}
        />

        <Container maxWidth="sm" sx={{ position: "relative", zIndex: 1 }}>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <Box
              sx={{
                px: 2,
                py: 0.75,
                borderRadius: 999,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
                color: "text.secondary",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              ERROR 404
            </Box>

            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "5rem", sm: "7rem" },
                lineHeight: 0.95,
                fontWeight: 800,
                letterSpacing: "-0.06em",
                background:
                  "linear-gradient(135deg, #2f66ff 0%, #6d5efc 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                color: "transparent",
              }}
            >
              404
            </Typography>

            <Stack spacing={1.25} alignItems="center">
              <Typography
                component="h2"
                variant="h4"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  fontSize: { xs: "1.6rem", sm: "2rem" },
                }}
              >
                Page not found
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 460, lineHeight: 1.8 }}
              >
                The page you are looking for doesn&apos;t exist, has been moved,
                or the URL may be incorrect.
              </Typography>
            </Stack>

            <Button
              component={RouterLink}
              to="/"
              variant="contained"
              size="large"
              startIcon={<HomeRoundedIcon />}
              sx={{
                mt: 1,
                px: 3,
                py: 1.35,
                minWidth: 180,
                boxShadow: "0 14px 30px rgba(47,102,255,0.22)",
              }}
            >
              Back to Home
            </Button>

            <Button
              component="button"
              variant="text"
              color="inherit"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={() => window.history.back()}
              sx={{ color: "text.secondary" }}
            >
              Go back
            </Button>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
