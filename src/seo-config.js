const DEFAULT_SITE_URL = "https://echonode.website";
const DEFAULT_SITE_NAME = "PassDeployer";
const DEFAULT_API_ORIGIN = "https://api.echonode.website";
const DEFAULT_DESCRIPTION = "Deploy applications, manage services, and control the infrastructure around your workloads from one focused platform.";

export const PUBLIC_PAGES = {
  "/": {
    title: "PassDeployer | Application Deployment & Management",
    description:
      "Deploy applications, manage services, and choose the resources you need. Start small, use hourly plans when they fit, and scale as your workload grows.",
  },
  "/plans": {
    title: "Plans & Pricing | PassDeployer",
    description:
      "Compare PassDeployer plans for CPU, memory and storage. Choose the right capacity for your application and scale when your workload changes.",
  },
  "/aboutUs": {
    title: "About PassDeployer | Application Deployment Platform",
    description:
      "Learn how PassDeployer brings application deployment and day-to-day service management into one focused developer platform.",
  },
  "/docs": {
    title: "Documentation | PassDeployer",
    description:
      "Read PassDeployer guides, references and how-tos for deploying, configuring and managing applications.",
  },
  "/signin_or_signup": {
    title: "Sign in or Sign up | PassDeployer",
    description:
      "Sign in to your PassDeployer account or create an account to start deploying and managing applications.",
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

export function isDocsPath(pathname = "/") {
  const normalized = normalizePathname(pathname);
  return normalized === "/docs" || normalized.startsWith("/docs/");
}

export function isNoIndex(pathname) {
  const normalized = normalizePathname(pathname);
  return NOINDEX_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(prefix),
  );
}

export function getSiteConfig(env = {}) {
  const siteUrl = String(env.VITE_APP_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");
  const siteName = env.VITE_APP_NAME || DEFAULT_SITE_NAME;
  const preview = env.VITE_APP_PREVIEW || `${siteUrl}/preview.png`;
  const apiOrigin = String(
    env.VITE_API_ORIGIN || (env.VITE_API_BASE ? `https://${env.VITE_API_BASE}` : DEFAULT_API_ORIGIN),
  ).replace(/\/+$/, "");
  return { siteUrl, siteName, preview, apiOrigin };
}

export function canonicalUrl(pathname, siteUrl) {
  const normalized = normalizePathname(pathname);
  return `${String(siteUrl).replace(/\/+$/, "")}${normalized === "/" ? "/" : normalized}`;
}

export function buildSchema(page, pathname, siteConfig, { docs = null } = {}) {
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
  } else if (docs) {
    graph.push({
      "@type": "TechArticle",
      "@id": `${pageUrl}#article`,
      headline: docs.title,
      description: docs.description || page.description,
      url: pageUrl,
      datePublished: docs.published_at || docs.created_at,
      dateModified: docs.updated_at || docs.published_at || docs.created_at,
      isPartOf: { "@id": `${siteUrl}/#website` },
    });
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
        { "@type": "ListItem", position: 2, name: "Documentation", item: `${siteUrl}/docs` },
        { "@type": "ListItem", position: 3, name: docs.title, item: pageUrl },
      ],
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
    intro: DEFAULT_DESCRIPTION,
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
  "/docs": {
    heading: "Documentation for deploying and managing applications.",
    intro:
      "Browse published guides, references and practical how-tos for PassDeployer.",
  },
};
