# Keycloak, organizations, and user administration

The CRM uses Keycloak for identity, Auth.js JWT cookies for application login, Prisma for authorization, and `AppSession` rows for server-side session revocation. CRM authorization is not derived from Keycloak roles.

## Required configuration

Copy the authentication variables from `.env.example` and configure two Keycloak clients:

- The login client is a confidential OIDC client referenced by `AUTH_KEYCLOAK_ID` and `AUTH_KEYCLOAK_SECRET`. Allow `${AUTH_URL}/api/auth/callback/keycloak` and `${AUTH_URL}/auth/keycloak` as redirect URIs.
- The Admin API client is a separate service-account client referenced by `AUTH_KEYCLOAK_ADMIN_CLIENT_ID` and `AUTH_KEYCLOAK_ADMIN_CLIENT_SECRET`. Grant realm permissions sufficient to view/manage users and view/manage sessions.
- Configure realm SMTP. New identities receive a Keycloak execute-actions email for `VERIFY_EMAIL` and `UPDATE_PASSWORD`.
- Set `SUPER_ADMIN_EMAILS` to a comma-separated email allowlist. These users are the only identities provisioned just in time; every other identity must first be invited.

`AUTH_SECRET` must be a long random value and `AUTH_URL` must match the browser-visible origin. Because `trustHost` is enabled, production proxies must provide a trustworthy host.

## Local database

The repository now has a Prisma migration history. The selected rollout resets the development database:

```bash
npm run prisma:reset
```

This creates the `Robert` organization and representative CRM records. The seeded `usr-parsa` row is a suspended audit identity and cannot sign in. An allow-listed super admin signs in at `/auth/keycloak`, opens `/super-admin`, and adds an administrator to the seeded organization or creates a new organization with its first administrator.

## Authorization rules

- Every CRM API resolves the authenticated Prisma user and the active organization membership.
- `crm_active_organization` is an HTTP-only organization-selection cookie. It never grants access without a fresh active membership check.
- Organization admins manage only memberships in their active organization.
- Global identity, credential, suspension, and session operations require a super admin.
- Removing or suspending the last active organization admin is rejected.
- Super admins need an explicit organization membership before opening that tenant's CRM data.
- The automatic unauthenticated fixture fallback has been removed; database/authentication failures fail closed.

## Verification

Run the authenticated HTTP suite against a development server using the same `AUTH_SECRET`:

```bash
AUTH_SECRET='same-secret-used-by-the-server' \
CRM_BASE_URL='http://127.0.0.1:3004' \
npm run test:usecases
```

The script creates an encrypted Auth.js test cookie locally; no test-only authentication endpoint is exposed.
