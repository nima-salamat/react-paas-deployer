# Frontend documentation

This directory contains engineering documentation for the React PaaS Deployer frontend.

## Feature guides

- [Ready Apps](ready-apps.md) — routes, component boundaries, schema-driven wizard, API integration, installation workspace, security rules and extension guidance.

## Documentation ownership

Frontend documentation describes UI responsibilities and integration contracts.

The Django backend remains the source of truth for:

- catalog publication;
- catalog schema validation;
- server-side resolution;
- plan and resource allocation;
- hostname policy;
- secret storage;
- application installation lifecycle;
- deployment/runtime behavior.

When frontend and backend behavior appear to conflict, update the backend contract first and then align the frontend.

## Documentation rule

Prefer documenting stable routes, responsibilities, contracts and invariants. Avoid copying large implementation details that can drift after ordinary refactors.
