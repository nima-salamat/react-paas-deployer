const DEFAULT_SITE_URL = "https://echonode.website";
const DEFAULT_SITE_NAME = "PassDeployer";

export const PUBLIC_PAGES = {
  "/": {
    title: "PassDeployer | Application Deployment & Management",
    description:
      "Deploy applications, manage services, and choose the resources you need. Start small, use hourly plans when they fit, and scale your workload when it grows.",
  },
  "/plans": {
    title: "Plans & Pricing | PassDeployer",
    description:
      "Compare PassDeployer plans for CPU, memory and storage. Start with the resources you need and scale your application as your workload grows.",
  },
  "/aboutUs": {
    title: "About PassDeployer | Application Deployment Platform",
    description:
      "Learn how PassDeployer simplifies application deployment and day-to-day service management with a focused developer platform.",
  },
  "/docs": {
    title: "Documentation | PassDeployer",
    description:
      "Guides, references and how-tos for deploying and managing applications on PassDeployer.",
  },
};

export const NOINDEX_PREFIXES = [
  "/profile",
  "/services",
  "/service/",
  "/volumes",
  "/networks",
  "/tickets",
  "/staff",
  "/admin",
  "/messenger",
  "/signin_or_signup",
];

export function normalizePathname(pathname = "/") {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isNoIndex(pathname) {
  return NOINDEX_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

export function getSiteConfig(env = {}) {
  const siteUrl = String(env.VITE_APP_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const siteName = env.VITE_APP_NAME || DEFAULT_SITE_NAME;
  const preview = env.VITE_APP_PREVIEW || `${siteUrl}/preview.png`;
  return { siteUrl, siteName, preview };
}

export function canonicalUrl(pathname, siteUrl) {
  const normalized = normalizePathname(pathname);
  return `${String(siteUrl).replace(/\/+$/, "")}${normalized === "/" ? "/" : normalized}`;
}

export function buildSchema(page, pathname, siteConfig) {
  if (!page) return null;

  const { siteUrl, siteName } = siteConfig;
  const pageUrl = canonicalUrl(pathname, siteUrl);
  const graph = [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: siteName,
      url: `${siteUrl}/`,
      logo: `${siteUrl}/icon.svg`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: siteName,
      url: `${siteUrl}/`,
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: page.title,
      description: page.description,
      isPartOf: { "@id": `${siteUrl}/#website` },
    },
  ];

  if (pathname === "/") {
    graph.push({
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#software`,
      name: siteName,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: pageUrl,
      description: page.description,
      publisher: { "@id": `${siteUrl}/#organization` },
    });
  } else {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: page.title.split(" | ")[0], item: pageUrl },
      ],
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export const SEO_FALLBACK_CONTENT = {
  "/": {
    heading: "Deploy faster. Manage everything in one place.",
    intro:
      "PassDeployer is a focused platform for deploying applications and managing the services, resources, networks and persistent storage around them.",
  },
  "/plans": {
    heading: "Choose resources that fit your application.",
    intro:
      "Compare CPU, memory and storage options, then adjust resources as your workload changes.",
  },
  "/aboutUs": {
    heading: "A simpler way to run applications.",
    intro:
      "PassDeployer brings application deployment and day-to-day infrastructure management into one focused control plane.",
  },
};
