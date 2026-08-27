import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

const SITE_URL = (import.meta.env.VITE_APP_URL || "").replace(/\/+$/, "");

const PUBLIC_PAGES = {
  "/": {
    title: "PassDeployer | Deploy Apps Easily",
    description:
      "PassDeployer helps you deploy and manage Django, Node.js, Flask and Docker apps. Simple PaaS for developers — start, stop, scale and monitor in one place.",
  },

  "/plans": {
    title: "Plans | PassDeployer",
    description:
      "Compare PassDeployer plans and pick the CPU, RAM and storage that fit your Django, Node.js, Flask or Docker application.",
  },

  "/aboutUs": {
    title: "About PassDeployer",
    description:
      "Learn how PassDeployer helps teams deploy and manage Django, Node.js, Flask and Docker applications on a self-hosted PaaS.",
  },

  "/signin_or_signup": {
    title: "Sign in or Sign up | PassDeployer",
    description:
      "Sign in to PassDeployer or create a free account to deploy and manage your Django, Node.js, Flask and Docker applications.",
  },
};

export default function SEO() {
  const location = useLocation();

  const pathname =
    location.pathname.replace(/\/+$/, "") || "/";

  const page = PUBLIC_PAGES[pathname];
  const isPublic = Boolean(page);

  const title = page?.title || "PassDeployer";
  const description =
    page?.description ||
    "PassDeployer helps you deploy and manage Django, Node.js, Flask and Docker applications.";

  const url =
    pathname === "/"
      ? `${SITE_URL}/`
      : `${SITE_URL}${pathname}`;

  return (
    <Helmet>
      <title>{title}</title>

      <meta
        name="description"
        content={description}
      />

      <meta
        name="robots"
        content={
          isPublic
            ? "index, follow, max-image-preview:large"
            : "noindex, nofollow"
        }
      />

      <meta
        name="googlebot"
        content={
          isPublic
            ? "index, follow, max-image-preview:large"
            : "noindex, nofollow"
        }
      />

      {isPublic && (
        <>
          <link
            rel="canonical"
            href={url}
          />

          <meta property="og:type" content="website" />
          <meta property="og:site_name" content="PassDeployer" />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={url} />

          <meta
            property="og:image"
            content={`${SITE_URL}/preview.png`}
          />

          <meta
            property="og:image:type"
            content="image/png"
          />

          <meta
            property="og:image:width"
            content="1200"
          />

          <meta
            property="og:image:height"
            content="675"
          />

          <meta
            property="og:image:alt"
            content="PassDeployer"
          />

          <meta
            name="twitter:card"
            content="summary_large_image"
          />

          <meta
            name="twitter:title"
            content={title}
          />

          <meta
            name="twitter:description"
            content={description}
          />

          <meta
            name="twitter:image"
            content={`${SITE_URL}/preview.png`}
          />

          <meta
            name="twitter:image:alt"
            content="PassDeployer"
          />
        </>
      )}
    </Helmet>
  );
}
