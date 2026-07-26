# Reloriq CRM

Reloriq CRM is a Next.js/PostgreSQL application with Lightning-compatible routes, tenant-scoped server services,
route-scoped data loading, and dynamically imported feature workspaces.

- [Architecture](docs/architecture.md)
- [Local development](docs/development.md)
- [Testing](docs/testing.md)

For a fresh checkout, install dependencies, generate Prisma, apply migrations, seed PostgreSQL, and start Next.js:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run dev
```

Use `npm run check` for the local quality gate and `npm run build` for the production build.
