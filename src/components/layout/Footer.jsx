// components/layout/Footer.jsx
import React from "react";
import {
  Box,
  Container,
  Divider,
  Link as MuiLink,
  Stack,
  Typography,
  useTheme,
  alpha,
} from "@mui/material";
import { Link as RouterLink, useLocation } from "react-router-dom";
import GitHubIcon from "@mui/icons-material/GitHub";

const GITHUB_API = "https://github.com/nima-salamat/django-paas-deployer";
const GITHUB_FRONTEND = "https://github.com/nima-salamat/react-paas-deployer";

const DEFAULT_ICON = "/icon.svg";

/**
 * The full marketing footer (brand + link columns) is reserved for the
 * public landing pages. Every other page inside the Layout renders the
 * slim single-row footer instead, so app pages stay visually quiet.
 */
const FULL_FOOTER_ROUTES = new Set(["/", "/aboutUs", "/plans"]);

const footerColumns = [
  {
    heading: "Product",
    links: [
      { label: "Plans & pricing", to: "/plans" },
      { label: "Documentation", to: "/docs" },
    ],
  },
  {
    heading: "Project",
    links: [
      { label: "About us", to: "/aboutUs" },
      { label: "Django backend", href: GITHUB_API, external: true },
      { label: "React frontend", href: GITHUB_FRONTEND, external: true },
    ],
  },
];

const thinLinks = [
  { label: "Plans", to: "/plans" },
  { label: "Docs", to: "/docs" },
  { label: "About", to: "/aboutUs" },
];

const Footer = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const year = new Date().getFullYear();
  const { pathname } = useLocation();
  const isFullFooter = FULL_FOOTER_ROUTES.has(pathname);

  const surface = {
    bgcolor: isDark ? "grey.900" : "grey.100",
    color: "text.secondary",
    borderTop: 1,
    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
  };

  const linkSx = {
    fontSize: "0.8rem",
    color: "text.secondary",
    transition: "color 160ms ease",
    "&:hover": { color: "primary.main" },
  };

  /* ── Thin footer: one compact row for app / inner pages ── */
  if (!isFullFooter) {
    return (
      <Box component="footer" sx={surface}>
        <Container maxWidth="xl">
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems="center"
            justifyContent={{ xs: "center", sm: "space-between" }}
            spacing={{ xs: 1, sm: 2 }}
            sx={{ py: 1.75, flexWrap: "wrap" }}
          >
            <Stack direction="row" spacing={0.9} alignItems="center">
              <Box
                component="img"
                src={DEFAULT_ICON}
                alt=""
                sx={{ width: 18, height: 18, opacity: 0.9 }}
              />
              <Typography
                variant="caption"
                sx={{ fontWeight: 800, color: "text.primary" }}
              >
                PassDeployer
              </Typography>
            </Stack>

            <Stack
              direction="row"
              spacing={1.6}
              alignItems="center"
              divider={
                <Box
                  sx={{
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    bgcolor: alpha(theme.palette.primary.main, 0.45),
                    display: { xs: "none", sm: "block" },
                  }}
                />
              }
              sx={{ flexWrap: "wrap", justifyContent: "center", rowGap: 0.5 }}
            >
              {thinLinks.map((link) => (
                <MuiLink
                  key={link.label}
                  component={RouterLink}
                  to={link.to}
                  underline="hover"
                  sx={linkSx}
                >
                  {link.label}
                </MuiLink>
              ))}
            </Stack>

            <Typography variant="caption" sx={{ fontSize: "0.75rem" }}>
              © {year} PassDeployer
            </Typography>
          </Stack>
        </Container>
      </Box>
    );
  }

  /* ── Full footer: home, about us, plans ── */
  return (
    <Box component="footer" sx={surface}>
      <Container maxWidth="xl">
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "1.4fr 1fr 1fr",
            },
            gap: { xs: 3, sm: 4 },
            py: { xs: 3.5, md: 4.5 },
          }}
        >
          {/* Brand block */}
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box
                component="img"
                src={DEFAULT_ICON}
                alt=""
                sx={{ width: 22, height: 22 }}
              />
              <Typography sx={{ fontWeight: 800, color: "text.primary" }}>
                PassDeployer
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ maxWidth: 340, lineHeight: 1.7 }}>
              Deploy applications, manage services and keep your
              infrastructure in one focused control plane — open source
              and built for developers.
            </Typography>
          </Stack>

          {/* Link columns */}
          {footerColumns.map((column) => (
            <Stack key={column.heading} spacing={1.25}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "text.primary",
                }}
              >
                {column.heading}
              </Typography>

              <Stack spacing={0.75}>
                {column.links.map((link) => (
                  <MuiLink
                    key={link.label}
                    component={link.external ? "a" : RouterLink}
                    href={link.external ? link.href : undefined}
                    to={link.external ? undefined : link.to}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    underline="hover"
                    sx={{
                      fontSize: "0.875rem",
                      width: "fit-content",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      color: "text.secondary",
                      transition: "color 160ms ease",
                      "&:hover": {
                        color: "primary.main",
                      },
                    }}
                  >
                    {link.external && (
                      <GitHubIcon sx={{ fontSize: 15, opacity: 0.7 }} />
                    )}
                    {link.label}
                  </MuiLink>
                ))}
              </Stack>
            </Stack>
          ))}
        </Box>

        <Divider
          sx={{
            borderColor: isDark
              ? "rgba(255,255,255,0.06)"
              : "rgba(0,0,0,0.06)",
          }}
        />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={1}
          sx={{ py: 2 }}
        >
          <Typography variant="caption">
            © {year} PassDeployer — open-source PaaS platform.
          </Typography>

          <Typography
            variant="caption"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            Built with Django, React and Docker
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;
