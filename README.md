# React PaaS Deployer

Web dashboard for the self-hosted **PaaS Deployer** platform.  
Manage services, deploys, volumes, networks, and plans against the Django control plane.

Backend:  
[django-paas-deployer](https://github.com/nima-salamat/django-paas-deployer)

---

## Purpose

This app is the operator UI for a Docker-based PaaS:

- Sign in (JWT, optional OTP / invite flows from the API)  
- Browse **plans** and create **services**  
- Upload **deploys** (ZIP), select a version, start / stop / rebuild  
- Watch **live logs** and deployment progress over WebSockets  
- Manage **private networks** and **exclusive volumes** with plan storage quotas  
- Profile and theme (light / dark / system)

It is built as a responsive SPA so the same workflows work on desktop and mobile.

---

## How it works

```
Browser (this app)
    │  REST (axios + JWT refresh)
    │  WebSocket (service logs, deploy events)
    ▼
Django API  →  Celery  →  Docker
```

1. User authenticates; access/refresh tokens are stored in `localStorage`.  
2. API helper retries once after refresh on `401`.  
3. Service list and detail pages poll status and open WS streams when needed.  
4. Creating a service attaches a network and optional volumes, then deploys run through the backend orchestrator.  
5. Settings UI enforces the same volume rules as the API (no unsafe edits while a container is running).

---

## Features

- **Home** – product overview and entry points  
- **Services** – card/list views, filters (app vs database), start/stop, edit dialog  
- **Service detail** – overview, create/select deploys, live logs, settings (network, volumes, plan)  
- **Volumes & networks** – dedicated management pages  
- **Plans** – choose resource plans before creating a service  
- **Auth** – sign-in / sign-up flow aligned with backend login settings  
- **Floating navigation** – quick links; mobile service FAB for section switching  
- **Theming** – light, dark, or system preference  

---

## Stack

- React 19  
- Vite 7  
- React Router 7  
- MUI 7 (+ icons, date pickers)  
- Axios  
- Framer Motion  
- Emotion  

---

## Requirements

- Node.js 20.19+  
- A running [django-paas-deployer](https://github.com/nima-salamat/django-paas-deployer) API  

---

## Quick start

```bash
git clone https://github.com/nima-salamat/react-paas-deployer.git
cd react-paas-deployer

cp .env.example .env
# Set VITE_API_BASE to your API host (no protocol), e.g. api.example.com

npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

Docker (optional):

```bash
docker compose -f docker-compose.yaml up --build
```

---

## Environment

From `.env.example`:

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | API hostname (e.g. `api.example.com`) used to build `https://…` URLs |
| `VITE_DEPLOY_BASE` | Public deployment domain base (optional UI display) |
| `VITE_APP_NAME` | Product name shown in the UI |
| `VITE_APP_DESCRIPTION` | Short marketing description |
| `VITE_APP_URL` | Canonical frontend URL |
| `VITE_APP_PREVIEW` | Open Graph / preview image URL |

The client talks to the backend over HTTPS using `VITE_API_BASE` (auth, services, volumes, networks, plans, WebSockets).

---

## Main routes

| Path | Screen |
|------|--------|
| `/` | Home |
| `/services` | Service list |
| `/service/:id` | Service detail (overview, deploys, logs, settings) |
| `/volumes` | Volumes |
| `/networks` | Networks |
| `/plans` | Plans |
| `/signin_or_signup` | Authentication |
| `/profile` | User profile |
| `/aboutUs` | About |

---

## UX notes

- **Desktop:** sidebar / full panels for service sections.  
- **Mobile:** compact header + bottom sheet via a service FAB (mirrored to the global floating nav).  
- **Volumes:** create, attach, detach, delete; metadata edit only when the backend allows (Docker volume not provisioned / container not running).  
- **Logs:** service stream + deploy event history with mobile-friendly layout.

---

## Related repository

Control plane and orchestrator:

**https://github.com/nima-salamat/django-paas-deployer**

---

## License

No license file is published in the repository yet. Add one if you intend to open the project for reuse.

---

## SEO architecture

SEO is treated as a build/runtime contract rather than a collection of page-level meta tags.

- `src/seo-config.js` is the route metadata and indexability source of truth.
- `vite-prerender-plugin` generates real HTML for the indexable public marketing routes at build time.
- The prerendered HTML contains the actual React page structure, canonical metadata, Open Graph/Twitter metadata, and JSON-LD.
- `server.js` serves a prerendered route directly when the build produced and marked it; otherwise it falls back to dynamic rendering.
- Historical `/amp` URLs permanently redirect to the canonical home URL. AMP is no longer published.
- Private application routes are explicitly `noindex` and are excluded from the XML sitemap.
- Public documentation pages remain dynamic because their content is managed by the Django API. A successful document response is cached in-process; a transient API failure returns HTTP 503 instead of falsely turning an existing document into a 404.
- `scripts/seo-audit.mjs` verifies the generated public HTML after every build.

Build and validate:

```bash
npm ci
npm run build
npm run seo:check
npm run start   # node server.js → port 3000
```

For production, the edge proxy should canonicalize the public host (HTTPS and the preferred hostname) before requests reach Node. Keep application routing and SEO redirects at the same canonical URL policy.

Do not add hidden keyword blocks or crawler-only content. The prerendered HTML is the same React UI that users receive, followed by normal client-side bootstrapping.
