# Local development

## Prerequisites

- Node.js and npm
- PostgreSQL
- the environment values documented in `.env.example`

Install and prepare the database:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```

Start the application with `npm run dev`.

## Quality commands

- `npm run format` — format the repository.
- `npm run format:check` — verify formatting without changing files.
- `npm run lint` — ESLint CLI with zero warnings allowed.
- `npm run typecheck` — strict TypeScript check.
- `npm run test:unit` — selectors, schemas, calculations, services, and other pure behavior.
- `npm run test:component` — React Testing Library component behavior.
- `npm run test:usecases` — authenticated API scenarios against a running app and PostgreSQL.
- `npm run test:e2e` — authenticated Playwright browser smoke tests.
- `npm run check:files` — report handwritten source modules over 500 lines.
- `npm run check` — the fast local aggregate gate.
- `npm run build` — the production Next.js build.

The API use-case runner defaults to `http://127.0.0.1:3001`; override it with `CRM_BASE_URL`. It creates an
encrypted Auth.js cookie from `AUTH_SECRET` and removes its test fixtures when complete.

## Adding a feature

1. Add Zod input and DTO contracts.
2. Put authorization and tenant-scoped business behavior in a server service.
3. Keep the route handler as a small adapter using shared error mapping.
4. Add organization-scoped query keys and invalidate the narrowest affected list/detail/shell key.
5. Add selector/service unit tests and user-visible component or browser coverage.
6. Run `npm run check` and `npm run build`.
