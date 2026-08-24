const SITE_URL = (import.meta.env.VITE_APP_URL || "https://echonode.website").replace(/\/+$/, "");
const SITE_NAME = import.meta.env.VITE_APP_NAME || "PassDeployer";
const PREVIEW = import.meta.env.VITE_APP_PREVIEW || `${SITE_URL}/preview.png`;

const PAGES = {
  "/": {
    title: "PassDeployer | Deploy Django, Node.js, Flask & Docker Applications",
    description: "Deploy and manage Django, Node.js, Flask, and Docker applications with PassDeployer.",
    heading: "Deploy applications with PassDeployer",
    text: "Deploy and manage Django, Node.js, Flask, and Docker applications with a simple deployment platform.",
  },
  "/plans": {
    title: "Plans | PassDeployer",
    description: "Explore PassDeployer plans and choose the resources for your application.",
    heading: "Choose the right plan for your application",
    text: "Explore PassDeployer plans and choose the resources that fit your application.",
  },
  "/aboutUs": {
    title: "About PassDeployer",
    description: "Learn more about PassDeployer and the platform for deploying and managing applications.",
    heading: "About PassDeployer",
    text: "Learn more about PassDeployer and the platform for deploying and managing applications.",
  },
  "/signin_or_signup": {
    title: "Sign in or Sign up | PassDeployer",
    description: "Sign in to PassDeployer or create a new account.",
    heading: "Sign in or create your PassDeployer account",
    text: "Sign in to PassDeployer or create a new account to manage your applications.",
  },
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function prerender({ url }) {
  const pathname = new URL(url, "http://prerender.local").pathname.replace(/\/+$/, "") || "/";
  const page = PAGES[pathname] || PAGES["/"];
  const canonical = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;

  const organization = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/logo.png`,
  });

  const website = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/`,
  });

  return {
    html: `
      <main id="prerender-seo-shell">
        <h1>${esc(page.heading)}</h1>
        <p>${esc(page.text)}</p>
      </main>
    `,
    head: {
      lang: "en",
      title: page.title,
      elements: new Set([
        { type: "meta", props: { name: "description", content: page.description } },
        { type: "meta", props: { name: "robots", content: "index, follow, max-image-preview:large" } },
        { type: "meta", props: { name: "googlebot", content: "index, follow, max-image-preview:large" } },
        { type: "link", props: { rel: "canonical", href: canonical } },
        { type: "meta", props: { property: "og:type", content: "website" } },
        { type: "meta", props: { property: "og:site_name", content: SITE_NAME } },
        { type: "meta", props: { property: "og:title", content: page.title } },
        { type: "meta", props: { property: "og:description", content: page.description } },
        { type: "meta", props: { property: "og:url", content: canonical } },
        { type: "meta", props: { property: "og:image", content: PREVIEW } },
        { type: "meta", props: { property: "og:image:width", content: "1200" } },
        { type: "meta", props: { property: "og:image:height", content: "675" } },
        { type: "meta", props: { name: "twitter:card", content: "summary_large_image" } },
        { type: "meta", props: { name: "twitter:title", content: page.title } },
        { type: "meta", props: { name: "twitter:description", content: page.description } },
        { type: "meta", props: { name: "twitter:image", content: PREVIEW } },
        { type: "link", props: { rel: "icon", href: "/favicon.ico", sizes: "any" } },
        { type: "link", props: { rel: "icon", href: "/icon.svg", type: "image/svg+xml" } },
        { type: "link", props: { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" } },
        { type: "script", props: { type: "application/ld+json" }, children: organization },
        { type: "script", props: { type: "application/ld+json" }, children: website },
      ]),
    },
  };
}
