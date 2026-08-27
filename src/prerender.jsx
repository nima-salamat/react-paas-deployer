const SITE_URL = (import.meta.env.VITE_APP_URL || "https://echonode.website").replace(/\/+$/, "");
const SITE_NAME = import.meta.env.VITE_APP_NAME || "PassDeployer";
const PREVIEW = import.meta.env.VITE_APP_PREVIEW || `${SITE_URL}/preview.png`;

const PAGES = {
  "/": {
    title: "PassDeployer | Deploy Apps Easily",
    description:
      "PassDeployer helps you deploy and manage Django, Node.js, Flask and Docker apps. Simple PaaS for developers — start, stop, scale and monitor in one place.",
    heading: "Deploy applications with PassDeployer",
    text: `PassDeployer is a simple platform to deploy applications with PassDeployer and manage them without complex infrastructure setup.
You can deploy and manage Django, Node.js, Flask, and Docker applications from one dashboard.
Create a service, upload your code, choose a plan, and go live in minutes.
Monitor live logs, start or stop containers, attach volumes and private networks, and scale resources as your app grows.
PassDeployer is built for developers who want to deploy applications with PassDeployer quickly and keep full control over their stack.
Explore our plans, learn more about the platform, or sign in to start deploying today.`,
  },
  "/plans": {
    title: "Plans | PassDeployer",
    description:
      "Compare PassDeployer plans and pick the CPU, RAM and storage that fit your Django, Node.js, Flask or Docker application.",
    heading: "Choose the right plan for your application",
    text: `Explore PassDeployer plans and choose the resources that fit your application.
Each plan includes CPU, memory, storage and network options so you can deploy applications with PassDeployer at the right scale.
Start small and upgrade when your traffic grows. View plans and create a service when you are ready.`,
  },
  "/aboutUs": {
    title: "About PassDeployer",
    description:
      "Learn how PassDeployer helps teams deploy and manage Django, Node.js, Flask and Docker applications on a self-hosted PaaS.",
    heading: "About PassDeployer",
    text: `Learn more about PassDeployer and the platform for deploying and managing applications.
We built PassDeployer so developers can deploy applications with PassDeployer without wrestling with servers, Docker networking or CI scripts.
Read about our mission, stack and how the control plane works.`,
  },
  "/signin_or_signup": {
    title: "Sign in or Sign up | PassDeployer",
    description:
      "Sign in to PassDeployer or create a free account to deploy and manage your Django, Node.js, Flask and Docker applications.",
    heading: "Sign in or create your PassDeployer account",
    text: `Sign in to PassDeployer or create a new account to manage your applications.
After you sign up you can deploy applications with PassDeployer, create services, upload deploys and monitor logs from the dashboard.`,
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

  // SEO content stays in the HTML for crawlers, but is visually hidden.
  // Users only see a dark loading shell + spinner until React hydrates.
  // Extra paragraphs and internal links improve word count, keyword match
  // and internal link structure for SEO checkers.
  return {
    html: `
      <div id="app-boot-shell" aria-busy="true" aria-live="polite">
        <div class="app-boot-spinner" role="status" aria-label="Loading"></div>
        <main id="prerender-seo-shell">
          <h1>${esc(page.heading)}</h1>
          <p>${esc(page.text)}</p>
          <nav aria-label="Site">
            <ul>
              <li><a href="${SITE_URL}/">Home – Deploy applications with PassDeployer</a></li>
              <li><a href="${SITE_URL}/plans">Plans</a></li>
              <li><a href="${SITE_URL}/aboutUs">About PassDeployer</a></li>
              <li><a href="${SITE_URL}/signin_or_signup">Sign in or Sign up</a></li>
            </ul>
          </nav>
        </main>
      </div>
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
