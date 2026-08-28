import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE_URL = (import.meta.env.VITE_APP_URL || "https://echonode.website").replace(/\/+$/, "");
const SITE_NAME = import.meta.env.VITE_APP_NAME || "PassDeployer";
const PREVIEW = import.meta.env.VITE_APP_PREVIEW || `${SITE_URL}/preview.png`;

const PUBLIC_PAGES = {
  "/": {
    title: "PassDeployer | Faster, Easier Application Deployment & Management",
    description:
      "Deploy applications faster with less infrastructure busywork. Create services, manage resources, networks and persistent volumes, and change plans whenever your workload changes.",
  },
  "/plans": {
    title: "Plans & Pricing | PassDeployer",
    description:
      "Choose the CPU, RAM and storage your service needs. Compare deployment resources, start with a practical plan, and change plans as your workload grows.",
  },
  "/aboutUs": {
    title: "About PassDeployer | Simpler Application Deployment & Management",
    description:
      "Learn how PassDeployer aims to make application deployment, resource management and everyday infrastructure operations simpler from one control plane.",
  },
};

const NOINDEX_PREFIXES = [
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

function normalizePathname(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function isNoIndex(pathname) {
  return NOINDEX_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

function buildSchema(page, pathname) {
  const pageUrl = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: `${SITE_URL}/apple-touch-icon.png`,
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: page.title,
      description: page.description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
  ];

  if (pathname !== "/") {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: page.title.split(" | ")[0], item: pageUrl },
      ],
    });
  }

  if (pathname === "/") {
    graph.push({
      "@type": "SoftwareApplication",
      name: SITE_NAME,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      url: pageUrl,
      description: page.description,
    });

    graph.push({
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How does PassDeployer make deployment easier?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "PassDeployer puts service creation, deployment and everyday management into one workflow, reducing manual infrastructure setup between your code and a running service.",
          },
        },
        {
          "@type": "Question",
          name: "Can I manage networks and persistent volumes?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Networks and persistent volumes are managed as part of the service environment, alongside the applications that use them.",
          },
        },
        {
          "@type": "Question",
          name: "Can I change my plan later?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. You can move to a different resource plan when your workload changes instead of rebuilding your deployment workflow from scratch.",
          },
        },
        {
          "@type": "Question",
          name: "What can I manage after deployment?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You can monitor service status and resource usage, perform common lifecycle actions, and manage the resources and supporting infrastructure around your services from the same control plane.",
          },
        },
      ],
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export default function SEO() {
  const location = useLocation();
  const pathname = normalizePathname(location.pathname);
  const page = PUBLIC_PAGES[pathname];
  const isPublic = Boolean(page);
  const noindex = !isPublic || isNoIndex(pathname);

  const title = page?.title || `${SITE_NAME}`;
  const description = page?.description ||
    "PassDeployer is a developer-focused PaaS for deploying and managing applications.";
  const url = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;
  const robots = noindex
    ? "noindex, nofollow, noarchive"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  return (
    <Helmet>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <meta name="referrer" content="strict-origin-when-cross-origin" />

      {!noindex && <link rel="canonical" href={url} />}

      {!noindex && (
        <>
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content={SITE_NAME} />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={url} />
          <meta property="og:image" content={PREVIEW} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="675" />
          <meta property="og:image:alt" content="PassDeployer deployment platform" />
          <meta property="og:locale" content="en_US" />
          <meta name="twitter:url" content={url} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
          <meta name="twitter:image" content={PREVIEW} />
          <script type="application/ld+json">
            {JSON.stringify(buildSchema(page, pathname)).replaceAll("<", "\\u003c")}
          </script>
        </>
      )}
    </Helmet>
  );
}
