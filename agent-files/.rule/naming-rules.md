# Naming Rules

## Purpose
- Keep naming predictable across API routes, domain entities, services, and data fields.

## Core Conventions
- Prefer singular entity names by default.
  - Examples: `site.service`, `/api/site`
- Use consistent short terms across the codebase:
  - Always use `org` (not `organization`).
  - Always use `geo` (not `geolocation`, `localization`, etc.).
  - Use `lat` and `lng` for coordinates.

## API and File Naming
- Keep route and resource naming aligned with domain names.
- Avoid introducing synonyms for existing concepts.
