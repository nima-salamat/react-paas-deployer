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

- Node.js 18+ (20+ recommended)  
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

## SEO (server + SPA)

Public marketing routes (`/`, `/plans`, `/aboutUs`) receive:

1. **Server-injected `<head>`** – unique title, description, robots, canonical, hreflang, Open Graph, Twitter cards, and JSON-LD from `src/seo-config.js` (same source of truth as the React `SEO` component).
2. **Neutral loading shell** inside `#root` – a spinner only. Users never see a separate “SEO marketing page”; React’s `createRoot` replaces `#root` as soon as the app boots and the real Home / Plans / About UI is shown.
3. **`<noscript>` body** – route-specific readable HTML for non-JS agents. This is the only place the long SEO copy lives in the initial HTML; it is not shown when JavaScript is enabled.
4. **Private routes** (`/services`, `/profile`, `/admin`, `/messenger`, …) get `noindex, nofollow` and are excluded from `sitemap.xml`.

Build and run:

```bash
npm ci
npm run build
npm run start   # node server.js → port 3000
```

Production edge: use `nginx-seo.conf.example` so `/`, `/plans`, `/aboutUs`, `/robots.txt`, `/sitemap.xml`, and SPA fallbacks all hit the Node process. Canonical host is controlled at Nginx.

Do **not** put keyword blocks inside `#root` and hide them with CSS — that is cloaking. The current design keeps the visible UI identical for users and JS-capable crawlers, while still giving non-JS agents useful HTML.
