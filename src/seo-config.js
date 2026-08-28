const DEFAULT_SITE_URL = "https://echonode.website";
const DEFAULT_SITE_NAME = "PassDeployer";

export const PUBLIC_PAGES = {
  "/": {
    title: "PassDeployer | Application Deployment & Management",
    description:
      "Deploy and manage applications with less infrastructure work. Run services, control resources, networks and persistent storage from one platform.",
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

function answer(text) {
  return { "@type": "Answer", text };
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

    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "How does PassDeployer simplify deployment?",
          acceptedAnswer: answer(
            "PassDeployer brings service creation, deployment and everyday application management into one workflow, reducing repetitive infrastructure work between your code and a running service.",
          ),
        },
        {
          "@type": "Question",
          name: "Can I manage networks and persistent storage?",
          acceptedAnswer: answer(
            "Yes. PassDeployer provides dedicated management for private networks and persistent volumes alongside the services that use them.",
          ),
        },
        {
          "@type": "Question",
          name: "Can I change resources as my workload grows?",
          acceptedAnswer: answer(
            "Yes. You can change the resource plan for a service as traffic, workload size or application requirements change.",
          ),
        },
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
