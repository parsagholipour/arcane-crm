# Testing strategy

## Unit and component tests

Node's test runner covers pure functions and server-compatible modules. Characterization coverage includes route
parsing, list filtering/sorting, Kanban inputs, recurrence, validation, invoice calculations, lead conversion,
organization isolation, email, files, reports, and API schemas.

Vitest runs React Testing Library in jsdom for shell and reusable feedback behavior. Component tests should assert
accessible roles and user-visible behavior rather than implementation details.

## Authenticated API scenarios

`npm run test:usecases` expects PostgreSQL and a running app. The runner:

- creates an isolated authenticated user and membership;
- signs an Auth.js JWT with `AUTH_SECRET`;
- exercises named resource and domain-action endpoints;
- verifies tenant isolation and domain lifecycles; and
- deletes its fixtures in dependency order.

There is no test-only login endpoint.

## Playwright

Playwright global setup creates two isolated organizations and writes an encrypted Auth.js cookie to the ignored
`.playwright/auth.json` storage state. Browser coverage includes:

- shell navigation and global search;
- URL-driven create modals;
- generic record create/edit/delete;
- list-view persistence;
- lead conversion;
- recurring-event expansion/deletion;
- invoice lifecycle; and
- organization-switch isolation.

Run `npx playwright install chromium` once locally, then `npm run test:e2e`. Set
`PLAYWRIGHT_EXTERNAL_SERVER=1` when a server is already running.

## CI

GitHub Actions starts PostgreSQL, applies Prisma migrations, seeds the CRM, and runs formatting, lint, TypeScript,
unit/component tests, production build, authenticated use cases, and Playwright. Failures retain Playwright traces
and reports as artifacts.
