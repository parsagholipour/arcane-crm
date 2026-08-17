# CRM public API — Leads

Read-only Lead access for organization integrations, plus signed outbound webhooks.

|                 |                                                              |
| --------------- | ------------------------------------------------------------ |
| **API version** | `v1`                                                         |
| **Base URL**    | `https://<your-crm-host>/api/v1`                             |
| **Auth**        | `Authorization: Bearer crm_…`                                |
| **Format**      | JSON `{ "data": … }` or `{ "error": { "code", "message" } }` |

## 1. Authentication

An organization admin creates **one** tokenthe in **Setup → API Access**. The plaintext is shown once and stored only as a SHA-256 hash.

```http
GET /api/v1/me HTTP/1.1
Authorization: Bearer crm_…
```

```json
{
  "data": {
    "organization": { "id": "org_…", "name": "Arcane Fortress", "slug": "arcane-fortress" }
  }
}
```

Regenerating the token immediately invalidates the previous value. A suspended organization is rejected with `403`.

## 2. Leads

### `GET /api/v1/leads`

Cursor-paginated list. Every item is the full Lead object described below.

| Query          | Notes                                                |
| -------------- | ---------------------------------------------------- |
| `limit`        | 1–100, default 50                                    |
| `cursor`       | `nextCursor` from the previous page                  |
| `search`       | Matches first name, last name, company, email, phone |
| `status`       | Exact Lead Status                                    |
| `converted`    | `true` or `false`                                    |
| `updatedSince` | ISO 8601 — incremental sync                          |

```bash
curl -s "$CRM_BASE/leads?limit=50&updatedSince=2026-08-01T00:00:00.000Z" \
  -H "Authorization: Bearer $CRM_TOKEN"
```

### `GET /api/v1/leads/{id}`

One Lead. Unknown ids return `404` (the token's organization is the only tenant searched).

### Lead object

All Lead fields except the internal sample-reminder notification id, plus:

- `owner` — `{ id, name, alias, email }`
- `sampleProducts[]` — quantity, prices, and a trimmed `product`
- `shipment` — live USPS tracking when present
- conversion ids (`convertedAt`, `convertedAccountId`, `convertedContactId`, `convertedOpportunityId`)

Activity, files, and campaign memberships are not included. Poll `updatedSince` for shipment freshness; USPS poller writes do not emit webhooks.

## 3. Webhooks

Register one HTTPS URL in **Setup → API Access**. CRM generates a `whsec_…` signing secret (shown once, rotatable).

Events: `lead.created`, `lead.updated`, `lead.converted`, `lead.deleted`, and `webhook.test` from the Test button.

```json
{
  "id": "delivery-id",
  "event": "lead.updated",
  "createdAt": "2026-08-17T12:00:00.000Z",
  "organizationId": "org_…",
  "data": {}
}
```

`lead.deleted` `data` is `{ id, firstName, lastName, company, email, deletedAt }` only.

### Headers and signature

| Header            | Purpose                                  |
| ----------------- | ---------------------------------------- |
| `X-CRM-Event`     | Event name                               |
| `X-CRM-Delivery`  | Stable delivery id — deduplicate on this |
| `X-CRM-Timestamp` | Unix seconds                             |
| `X-CRM-Signature` | `t=<unix>,v1=<hex>`                      |

The signed string is `<timestamp>.<raw body>`, HMAC-SHA256 with the endpoint secret, hex-encoded. Match `v1` by name. Reject timestamps outside ±300 seconds. Verify against the **raw** body — re-serializing JSON changes the bytes.

This is the same scheme as PO App (`X-PO-Signature`); only the header names differ. See [docs/PO-API.md](PO-API.md) §10 for copy-paste verifiers in TypeScript, Python, and PHP.

Respond `2xx` within 10 seconds. Redirects are not followed. Deliveries are at-least-once and retried with backoff for about nine hours (six attempts). After 20 consecutive failed attempts the endpoint is disabled until an admin re-enables it.

**Not emitted:** internal sample-reminder bookkeeping, and USPS tracking poller updates. Use `GET /leads?updatedSince=…` for those.

## 4. Operations

Call `POST /api/webhooks/leads/dispatch` every five minutes with `Authorization: Bearer <LEAD_WEBHOOK_CRON_SECRET>` so failed deliveries are retried.
