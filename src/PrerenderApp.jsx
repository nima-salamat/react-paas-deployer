import React from "react";
import { StaticRouter } from "react-router";

import { CacheProvider } from "@emotion/react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { HelmetProvider } from "react-helmet-async";

import { getTheme } from "./theme";
import { createEmotionCache } from "./emotionCache";

import SEO from "./components/seo/SEO.jsx";
import Home from "./components/home/home.jsx";
import Plans from "./components/plans/plans.jsx";
import AboutUs from "./components/aboutUs/aboutUs.jsx";
import SigninOrSignup from "./components/signin_or_signup/signin_or_signup.jsx";

const PUBLIC_ROUTES = {
  "/": Home,
  "/plans": Plans,
  "/aboutUs": AboutUs,
  "/signin_or_signup": SigninOrSignup,
};

function normalizePathname(pathname = "/") {
  return pathname.replace(/\/+$/, "") || "/";
}

export default function PrerenderApp({ url }) {
  const pathname = normalizePathname(
    new URL(url, "http://prerender.local").pathname
  );

  const Page = PUBLIC_ROUTES[pathname];

  if (!Page) {
    return null;
  }
  const cache = createEmotionCache();
  const theme = getTheme("light");

  return (
    <StaticRouter location={url}>
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <HelmetProvider>
            <SEO />
            <Page />
          </HelmetProvider>
        </ThemeProvider>
      </CacheProvider>
    </StaticRouter>
  );
}
