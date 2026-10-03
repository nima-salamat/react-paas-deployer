# Ready Apps

The Ready Apps frontend is a schema-driven dashboard experience for deploying curated, platform-approved applications.

## Routes

| Route | Purpose |
|---|---|
| /dashboard/ready-apps | Curated application catalog |
| /dashboard/ready-apps/:id | Application detail and deployment entry point |
| /dashboard/ready-apps/installations/:id | Installation progress and managed-service workspace |

Ready Apps is registered inside the existing dashboard route tree. The sidebar exposes it under Workspace next to Overview.

## Component boundaries

| Component | Responsibility |
|---|---|
| src/components/ready_apps/ReadyApps.jsx | Safe public catalog landing page |
| src/components/ready_apps/ReadyAppDetail.jsx | Product detail and deployment entry point |
| src/components/ready_apps/ReadyAppWizard.jsx | Generic configuration/resource/review/deploy flow |
| src/components/ready_apps/ReadyAppInstallation.jsx | Installation status and managed-service workspace |

The frontend must not contain per-application branches such as app.id checks for individual recipes.

## Catalog list

The landing page requests:

~~~text
GET /api/application-catalog/apps/
~~~

The response is the safe public catalog DTO produced by Django.

Cards may consume product name, category, software version, logo, featured flag, feature labels and description. Raw Compose data must never be required by the page.

Featured applications are sorted first, followed by deterministic name ordering.

## Application detail

The detail page requests:

~~~text
GET /api/application-catalog/apps/<id>/
~~~

It presents product identity, managed components, requirements, documentation link, tags and the resource-validation note. The page does not calculate resource requirements.

## Generic deployment wizard

The wizard uses:

~~~text
Configure -> Resources -> Review -> Deploy
~~~

### Configure

The wizard collects installation name, supported variant and only the fields marked user-editable by the backend.

Client validation is limited to obvious request-shape checks. Semantic validation remains server-authoritative.

### Dynamic fields

| Backend type | Generic control |
|---|---|
| string | Text input |
| integer | Numeric input |
| boolean | Switch |
| choice | Select |
| domain | Platform hostname/display control |
| secret | Password input |

Safe UI metadata can provide group, order, advanced, placeholder and visible_when behavior.

Fields marked user_editable=false are not rendered as tenant-editable inputs.

### Resources

The wizard loads existing resource plans:

~~~text
GET /plans/?page_size=100
~~~

Only Docker APP/READY plans are offered as the base application plan.

Database children are matched by the backend according to their declared database platform; the UI does not invent a second database-plan selector.

### Review

The wizard calls:

~~~text
POST /api/application-catalog/apps/<id>/resolve/
~~~

Request shape:

~~~json
{
  "name": "my-app",
  "plan_id": "<uuid>",
  "variant": "default",
  "config": {}
}
~~~

The review renders the server response. The backend determines normalized configuration, generated values, public endpoints, topology, database-plan mapping and CPU/RAM/storage allocation.

Do not reproduce those business rules in React.

### Deploy

The validated inputs are submitted to:

~~~text
POST /api/application-catalog/installations/
~~~

A successful HTTP 202 response advances the UI to the installation workspace.

## Installation workspace

The workspace requests:

~~~text
GET /api/application-catalog/installations/<id>/
~~~

while the coordinator is active.

Polling interval: 2.5 seconds.

Polling stops at terminal status:

~~~text
running
failed
cancelled
~~~

The page shows installation identity, status, stage, public application URL, managed child Services, child Deploy status/stage/messages/errors and plan allocation for CPU/RAM/storage.

Allocation is selected-plan capacity, not live runtime usage.

## Managed child services

Every child service links to the existing Service Detail route:

~~~text
/dashboard/services/<service_id>
~~~

The Ready Apps workspace is a coordinator view and must not become a duplicate Service Detail implementation.

## Platform-managed hostname

The current Ready Apps flow uses only platform-owned HTTPS hostnames:

~~~text
<application-slug>.<DEPLOYMENT_DOMAIN>
~~~

The frontend may explain this rule but must not allow arbitrary custom-domain input. The backend has no domain ownership verification workflow yet.

## Secrets

User-editable secret fields are submitted only through the authenticated API flow.

The frontend must not:

- persist secret values in unrelated browser storage;
- echo secrets into review output;
- log secret values;
- invent database credentials;
- display secret plaintext from installation responses.

Installation status exposes only configured secret-slot names.

## Duplicate application name

A same-owner name conflict is returned as HTTP 409:

~~~json
{
  "code": "application_name_conflict",
  "existing_installation_id": "<uuid>"
}
~~~

The UI should offer to open the existing installation. It must not start a blind retry loop that mutates the application name.

## Cancellation

The installation page calls:

~~~text
POST /api/application-catalog/installations/<id>/cancel/
~~~

Cancellation is asynchronous from the UI perspective. Continue polling until the coordinator reaches a terminal state.

The browser never performs Docker cleanup directly.

## Error handling

Preserve the distinction between validation errors, duplicate-name conflicts, worker-queue failures, cancellation and failed installation states.

Use safe server fields such as error, detail, error_message and stable error codes. Do not collapse all backend failures into a generic message when a recoverable action exists.

## Security invariants

1. Consume only public catalog DTOs.
2. Never parse or render raw Compose in the browser.
3. Never replace backend resource calculations with frontend formulas.
4. Never allow arbitrary Docker runtime settings through Ready Apps.
5. Never expose private database/cache endpoints.
6. Never render secret plaintext.
7. Reuse the platform authentication/API session layer.

## Adding another Ready App

Normally no frontend change is required.

Add a trusted backend catalog definition with public metadata, a supported variant, user-editable field schema, managed components, requirements, outputs and executable topology.

The existing list, detail and wizard automatically render the new application.

## Adding a field type

A new semantic field type requires coordinated changes to backend validation, public serialization, resolver behavior, React control mapping, errors, tests and this documentation.

Unknown field types must not silently degrade to generic text inputs.

## Source map

~~~text
src/App.jsx
  route registration

src/components/dashboard/DashboardSidebar.jsx
  navigation

src/components/ready_apps/ReadyApps.jsx
  catalog landing

src/components/ready_apps/ReadyAppDetail.jsx
  product detail

src/components/ready_apps/ReadyAppWizard.jsx
  deployment wizard

src/components/ready_apps/ReadyAppInstallation.jsx
  installation workspace
~~~

## Verification

Run the existing frontend validation suite:

~~~bash
npm ci
npm run lint
npm run build
npm run seo:check
npm run test:auth
npm run test:service-detail
npm run test:agents
npm run test:ticket-editor
~~~

Ready Apps-specific verification should cover catalog loading, detail loading, every supported field type, plan filtering, backend resolve, review values, install, duplicate-name recovery, terminal polling, cancellation, Service Detail links and secret masking.

## Backend authority

The Django repository remains authoritative for the Ready Apps backend contract:

documentation/apps/app_catalog/ready-apps.md

That contract defines publication policy, catalog metadata, resource allocation, hostname policy, secret handling, installation state and curated recipes.
