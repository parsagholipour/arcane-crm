# CRM architecture

## Request and rendering flow

Lightning URLs remain the public navigation contract. The catch-all server page parses each URL into a typed
`ScreenDescriptor`, loads the authenticated tenant once, and requests only:

- the small shell payload (identity, organization, preferences, navigation, notifications, and utilities); and
- the payload for the active list, record, or feature workspace.

Both payloads are placed in organization-scoped TanStack Query keys before rendering. Read queries retry once.
Mutations never retry automatically. Changing organization removes the previous organization's cache and refreshes
the active server route.

`src/components/crm/CrmApp.tsx` is a compatibility export. The application composition lives in
`src/features/crm/app.tsx`, while `FeatureScreen` dynamically imports each workspace so the Lightning entry chunk
does not eagerly include every feature.

## Data boundaries

Prisma types stay in server code. Authenticated internal APIs use Zod at their request boundary and return explicit
DTO or feature payload types. New endpoints should return one of:

```ts
type ApiSuccess<T> = { data: T };
type ApiFailure = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string>;
  };
};
```

`GenericRecord` is reserved for the metadata-driven list/form framework. Feature work should define a domain DTO
instead of expanding the generic record shape. `ScopedCrmData` is a temporary UI composition shape populated only
for the current route; it is not an all-record bootstrap contract.

## Server modules

- `src/server/shell` loads tenant-scoped shell state.
- `src/server/screens` composes route-specific payloads.
- `src/server/records` owns list/detail queries, pagination, search, views, sorting, and serialization.
- `src/server/resources/mutations` owns typed resource settings and preference mutations.
- `src/server/workflows/actions` owns domain actions such as conversion, ownership, Knowledge lifecycle, and case
  merge.
- Route handlers authenticate, validate, call a service, and map errors. Business rules belong in services.

The removed `/api/bootstrap`, `/api/utilities`, and `/api/workflows` endpoints must not be reintroduced. Browser
requests go through `src/lib/api/client.ts`; resource and action paths are centralized in typed clients.

## Frontend modules

Shared visual primitives live in `src/components/ui`. Feature code is grouped under `src/features/crm` and
`src/components/crm/<domain>`. State that belongs to a route or feature stays in that feature. Cross-feature React
state is limited to shell utilities, toasts, and console tabs.

CRM metadata is divided into object definitions, forms, geographic data, navigation, options, and display helpers.
`src/lib/crm-metadata.ts` only re-exports those modules for stable imports.

## Size and dependency rules

`npm run check:files` reports handwritten TypeScript/TSX/JavaScript files above 500 lines. Generated schemas and
static metadata tables are excluded. A warning should be addressed by extracting domain logic, selectors, hooks,
or view components—not by hiding a feature behind another generic abstraction.
