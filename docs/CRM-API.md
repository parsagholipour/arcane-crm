# CRM — Public API & Webhooks

**Integration guide for external services.** Everything you need to read Lead data
out of CRM and receive change notifications in real time.

|                 |                                         |
| --------------- | --------------------------------------- |
| **API version** | `v1`                                    |
| **Base URL**    | `https://<your-crm-host>/api/v1`        |
| **Auth**        | `Authorization: Bearer crm_…`           |
| **Transport**   | HTTPS, server-to-server                 |
| **Format**      | JSON (UTF-8)                            |

---

## Contents

1. [Overview](#1-overview)
2. [Quickstart](#2-quickstart)
3. [Authentication](#3-authentication)
4. [Conventions](#4-conventions)
5. [Errors](#5-errors)
6. [Rate limits](#6-rate-limits)
7. [API reference](#7-api-reference)
8. [The Lead object](#8-the-lead-object)
9. [Integration recipes](#9-integration-recipes)
10. [Webhooks](#10-webhooks)
11. [Reference receiver](#11-reference-receiver)
12. [Troubleshooting](#12-troubleshooting)
13. [Operations](#13-operations)
14. [Versioning](#14-versioning)

---

## 1. Overview

CRM exposes two integration surfaces, both scoped to a **single organization**:

- **A read API** — pull Leads on demand or on a schedule.
- **Webhooks** — receive an HTTP callback when a Lead is created, changed, converted, or
  deleted, so you don't have to poll aggressively.

A token issued by one organization can only ever read that organization's Leads. There is
no cross-organization access and no account-wide token.

### What you can do today

| Capability                                                                              | Status                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------- |
| Read Leads (list, cursor-paginate, search, filter)                                      | ✅ Available                                |
| Read a Lead's owner, sample product lines, and USPS shipment (when present)             | ✅ Embedded in every Lead                   |
| Receive `lead.created` / `lead.updated` / `lead.converted` / `lead.deleted` webhooks    | ✅ Available                                |
| Create, update, or delete Leads through the public API                                  | ❌ Not exposed — `/api/v1/leads` is GET-only |
| Read Accounts, Contacts, Opportunities, Products, Cases, activity, or files as resources | ❌ Not exposed                              |

If you need one of the unavailable capabilities, talk to the CRM team — the surface is
designed to grow without breaking existing consumers.

### What you'll need

1. An **API token** (`crm_…`) — created by an organization admin in **Setup → API Access**.
2. For webhooks: a **publicly reachable HTTPS endpoint** that can accept `POST` requests.

---

## 2. Quickstart

**Step 1 — Get a token.** Ask an organization admin to open **Setup → API Access**, choose
**Create token**, and send you the value. The token is displayed exactly once and cannot
be recovered afterwards. There is **one token per organization**; creating another
(**Regenerate token**) immediately invalidates the previous value.

**Step 2 — Verify it works.**

```bash
export CRM_TOKEN="crm_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
export CRM_BASE="https://crm.example.com/api/v1"

curl -s "$CRM_BASE/me" -H "Authorization: Bearer $CRM_TOKEN"
```

```json
{
  "data": {
    "organization": {
      "id": "clyk2orgexample00000000001",
      "name": "Arcane Fortress",
      "slug": "arcane-fortress"
    }
  }
}
```

**Step 3 — Read your first page of Leads.**

```bash
curl -s "$CRM_BASE/leads?limit=2" -H "Authorization: Bearer $CRM_TOKEN"
```

That's the whole setup. Continue to [Integration recipes](#9-integration-recipes) for a
full catalogue sync, or [Webhooks](#10-webhooks) to receive live updates.

---

## 3. Authentication

Every request must carry a bearer token:

```http
GET /api/v1/leads HTTP/1.1
Host: crm.example.com
Authorization: Bearer crm_l0_rwGVqLAFQD9ga7neS9xbzAJcSCUWIEz85bHO37h0
```

The scheme is case-sensitive: the header must start with `Bearer ` (capital B, one space).

### Token format

Tokens look like `crm_` followed by 43 URL-safe base64 characters (32 random bytes, 256
bits of entropy). The `crm_` prefix makes them easy to spot in logs and secret scanners.

CRM stores only a SHA-256 hash of the token. Nobody — not even an organization admin —
can read the value back after creation. A lost token must be regenerated or revoked and
replaced.

There are **no scopes**. A live token grants read access to every Lead in that
organization, including nested owner, sample-product, and shipment data.

### Expiry and revocation

- Tokens do **not** expire on a timer.
- **Regenerate token** in Setup writes a new hash and invalidates the previous value on
  the very next request (`401 UNAUTHENTICATED`).
- **Revoke** clears the stored hash. The same `401` follows until a new token is created.
- Last-used time is stored on the organization's API-access row (throttled to at most
  once per minute). It is not currently shown in Setup.

A **suspended** organization is rejected with `403 FORBIDDEN` even if the token hash
still matches.

### Security requirements

> **Treat a token like a password.** It grants read access to the organization's entire
> Lead list, including contact details, sample pricing, and tracking numbers.

- **Server-side only.** Never ship a token to a browser, mobile app, or any client you
  don't control. The API sends no CORS headers, so browser calls from another origin
  will fail — this is deliberate.
- **Store it in a secret manager or environment variable**, never in source control.
- **Rotate on staff changes** or on any suspicion of exposure. Create the new token,
  deploy it, then revoke (or regenerate again) so the old value stops working.
- **Always use HTTPS.** A token sent over plain HTTP must be considered compromised.

---

## 4. Conventions

| Topic                    | Rule                                                                                                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HTTP methods**         | All published `/api/v1` endpoints are `GET`. Other methods are rejected by the framework (typically `405`).                                                                                          |
| **Content type**         | Responses are `application/json`, encoded UTF-8.                                                                                                                                                     |
| **Success envelope**     | Always `{ "data": T }`. A single Lead is `{ "data": { …lead } }`. A list is `{ "data": { "items", "total", "nextCursor" } }`.                                                                         |
| **Error envelope**       | `{ "error": { "code": "…", "message": "…", "fieldErrors"? } }` — see [Errors](#5-errors).                                                                                                            |
| **Identifiers**          | All ids are Prisma `cuid()` strings (for example `clyk2orgexample00000000001`). They are **not** UUIDs. Never reused.                                                                                |
| **Timestamps**           | ISO 8601 in UTC, via `Date.toISOString()`: `2026-08-17T08:09:10.000Z`.                                                                                                                               |
| **Money / decimals**     | JSON **strings**, not numbers. Prisma `Decimal` values are serialized with `JSON.stringify` (so `"19.99"`, not `19.99`). Parse with a decimal library; do not use IEEE floats.                       |
| **Nulls**                | `null` means "not set". Unset picklists are `null`, **not** the UI sentinel `"--None--"`. `sampleProducts` is always an array (possibly empty). `shipment` is `null` when there is no USPS tracking row. |
| **Unknown query params** | Ignored, not rejected.                                                                                                                                                                               |
| **New fields**           | May be added to any response at any time. Parse defensively and ignore what you don't recognise.                                                                                                     |
| **Read-only**            | There is no `POST`, `PATCH`, or `DELETE` on `/api/v1/leads`.                                                                                                                                         |

---

## 5. Errors

Every non-2xx response from `/api/v1` uses the same envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Check the highlighted values.",
    "fieldErrors": {
      "limit": "Number must be less than or equal to 100"
    }
  }
}
```

`code` is stable and safe to branch on. `message` is human-readable and may be reworded
between releases — don't parse it. `fieldErrors` appears on `VALIDATION_ERROR` only;
keys are query-parameter names.

| Status | `code`             | Meaning                                                                                          | What to do                                                                                          |
| ------ | ------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR` | A query parameter failed Zod parse (`limit` out of range, bad `updatedSince`, invalid `converted`). | Fix the request. Retrying unchanged will fail again.                                                |
| `401`  | `UNAUTHENTICATED`  | Missing header, malformed `Bearer` value, token not prefixed `crm_`, unknown, or revoked.        | Check the header format. If the token was regenerated or revoked, obtain a new one. Do not retry.   |
| `403`  | `FORBIDDEN`        | The organization is **suspended**, or another authorization failure that is not HTTP 401.        | Do not retry until the organization is active again.                                                |
| `404`  | `FORBIDDEN`        | No Lead with that id **in this organization**. HTTP status is `404`; `error.code` is `FORBIDDEN`. | Treat as "does not exist". An id belonging to a different organization also returns this, never a distinct "wrong tenant" code. |
| `500`  | `INTERNAL_ERROR`   | Server-side fault (including an unknown list `cursor` that Prisma cannot resolve).               | Retry with exponential backoff. If a cursor keeps failing, restart the list without `cursor`.       |

There is no `WWW-Authenticate` header on `401`.

**Missing Lead, honestly:** `GET /api/v1/leads/{id}` throws `AppAuthorizationError("Record not found.", 404)`. The shared mapper sets `error.code` to `UNAUTHENTICATED` only when `status === 401`; every other `AppAuthorizationError` becomes `FORBIDDEN`. So a missing Lead is:

```json
{ "error": { "code": "FORBIDDEN", "message": "Record not found." } }
```

with **HTTP 404**. Branch on the HTTP status for "not found"; do not expect `code: "NOT_FOUND"`.

**Rule of thumb:** retry `500`; never retry `400`, `401`, `403`, or `404`.

---

## 6. Rate limits

There is **no rate limiter** on the public API today. Successful and failed requests
carry no `RateLimit-*` or `Retry-After` headers, and you will not receive `429`.

Still:

- Prefer large pages (`limit=100`) over many tiny requests.
- Retry `500` with exponential backoff.
- Do not busy-loop; a reasonable ceiling is well under a few requests per second per
  token unless you have agreed something else with the CRM team.

---

## 7. API reference

### `GET /api/v1/me`

Confirms a token is live and reports which organization it can read. Useful as a
connectivity check during setup and as a health probe afterwards.

**Response `200`**

```json
{
  "data": {
    "organization": {
      "id": "clyk2orgexample00000000001",
      "name": "Arcane Fortress",
      "slug": "arcane-fortress"
    }
  }
}
```

| Field                | Type   | Nullable | Description                                                                 |
| -------------------- | ------ | :------: | --------------------------------------------------------------------------- |
| `organization.id`    | string |    no    | Organization id (`cuid()`). Matches `organizationId` on Leads and webhooks. |
| `organization.name`  | string |    no    | Display name.                                                               |
| `organization.slug`  | string |    no    | URL-safe identifier.                                                        |

The payload does **not** include a token id or scopes.

---

### `GET /api/v1/leads`

Lists Leads in the token's organization. Every item is the full [Lead object](#8-the-lead-object).

This is **cursor pagination**, not `page` / `pageSize`. Do not send those parameters;
they are ignored.

#### Query parameters

All parameters are optional. Filters combine with **AND**.

| Parameter      | Type                         | Default | Description                                                                                                                                                              |
| -------------- | ---------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cursor`       | string                       | —       | Id of the last Lead from the previous page (`data.nextCursor`). Must be a real Lead id; an unknown value surfaces as `500 INTERNAL_ERROR`.                               |
| `limit`        | integer 1–100                | `50`    | Page size. Values below `1` or above `100` return `400 VALIDATION_ERROR` — they are **not** silently capped.                                                             |
| `search`       | string, max 200              | `""`    | Case-insensitive substring match across **firstName, lastName, company, email, and phone**. Empty string means no search filter.                                         |
| `status`       | string, max 80               | —       | Exact Lead Status match (see [picklists](#picklists)). Not validated against the picklist — an unknown value returns an empty page.                                      |
| `converted`    | `true` \| `false`            | —       | `true` → `convertedAt` is not null. `false` → `convertedAt` is null. Any other value (including `TRUE`) returns `400 VALIDATION_ERROR`.                                  |
| `updatedSince` | ISO 8601 datetime            | —       | Only Leads whose `updatedAt` is **at or after** this instant (`>=`). Malformed timestamps return `400 VALIDATION_ERROR`.                                                 |

```bash
curl -s "$CRM_BASE/leads?limit=50&converted=false&updatedSince=2026-08-01T00:00:00.000Z" \
  -H "Authorization: Bearer $CRM_TOKEN"
```

**Order** is always `updatedAt` descending, then `id` descending. There is no `sort`
parameter.

#### Response `200`

```json
{
  "data": {
    "items": [{ "…": "Lead object" }],
    "total": 141,
    "nextCursor": "clyk2leadexample00000000050"
  }
}
```

| Field        | Type        | Description                                                                                          |
| ------------ | ----------- | ---------------------------------------------------------------------------------------------------- |
| `items`      | Lead[]      | This page of results. Empty array if nothing matches — never `null`.                                 |
| `total`      | integer     | Total Leads matching the filters, across all pages.                                                  |
| `nextCursor` | string \| null | Id of the **last item on this page**, or `null` when there is no further page. Pass it as `cursor`. |

When `items` is empty, `nextCursor` is `null`. Requesting past the end (a cursor whose
remaining set is empty) returns `200` with `items: []`, not `404`.

> **Pagination is not a snapshot.** Because the list is ordered by `updatedAt desc`, a
> Lead edited while you page can jump to the front (and be seen twice) or be pushed
> beyond the window (and be skipped). Always **upsert by `id`**. After a full walk, run
> an [incremental sync](#incremental-sync) so nothing stays missing.

---

### `GET /api/v1/leads/{id}`

Fetches one Lead in the token's organization.

```bash
curl -s "$CRM_BASE/leads/clyk2leadexample00000000001" \
  -H "Authorization: Bearer $CRM_TOKEN"
```

**Response `200`**

```json
{ "data": { "…": "Lead object" } }
```

**Errors**

| Status | `code`      | Cause                                              |
| ------ | ----------- | -------------------------------------------------- |
| `401`  | `UNAUTHENTICATED` | Missing or invalid token.                    |
| `403`  | `FORBIDDEN` | Organization suspended.                            |
| `404`  | `FORBIDDEN` | No Lead with that id in this organization. See [Errors](#5-errors). |

---

## 8. The Lead object

The same representation is returned by the list endpoint, the single-Lead endpoint, and
the `lead.created` / `lead.updated` / `lead.converted` webhook payloads.

```json
{
  "id": "clyk2leadexample00000000001",
  "organizationId": "clyk2orgexample00000000001",
  "status": "Sample requested",
  "salutation": "Ms.",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "company": "Analytical Engines",
  "title": "Mathematician",
  "website": "https://analytical.example",
  "description": "Requested a sample dice set for evaluation.",
  "ownerId": "clyk2userexample00000000001",
  "owner": {
    "id": "clyk2userexample00000000001",
    "name": "Casey Rivera",
    "alias": "casey",
    "email": "casey@example.com"
  },
  "rating": "Hot",
  "phone": "+1 555 0100",
  "email": "ada@example.com",
  "country": "United States",
  "street": "12 Engine Yard",
  "postalCode": "02139",
  "city": "Cambridge",
  "state": "Massachusetts",
  "numberOfEmployees": 12,
  "annualRevenue": "120000",
  "leadSource": "Web",
  "industry": "Technology",
  "sampleRequestedDate": "2026-08-01T00:00:00.000Z",
  "sampleStatus": "Shipped",
  "courier": "USPS",
  "trackingNumber": "9400111899223197428490",
  "deliveryDate": null,
  "convertedAt": null,
  "convertedAccountId": null,
  "convertedContactId": null,
  "convertedOpportunityId": null,
  "createdById": "clyk2userexample00000000001",
  "updatedById": "clyk2userexample00000000001",
  "createdAt": "2026-08-01T10:11:12.000Z",
  "updatedAt": "2026-08-17T08:09:10.000Z",
  "sampleProducts": [
    {
      "id": "clyk2lineexample00000000001",
      "productId": "clyk2prodexample00000000001",
      "quantity": "2.0000",
      "unitPrice": "10.00",
      "totalPrice": "20.00",
      "description": null,
      "displayOrder": 0,
      "product": {
        "id": "clyk2prodexample00000000001",
        "name": "Obsidian Dice Set",
        "family": null,
        "productCode": null,
        "sku": "AF-DICE-001",
        "category": "Accessories",
        "active": true,
        "description": "Seven-piece polished set.",
        "upcGtin": "0123456789012",
        "imageLink": "https://cdn.example.com/dice.jpg",
        "price": "19.99",
        "productType": "Dice",
        "collectionName": "Core Line",
        "manufacturerName": "Ironforge Works"
      }
    }
  ],
  "shipment": {
    "id": "clyk2shipexample00000000001",
    "carrier": "USPS",
    "trackingNumber": "9400111899223197428490",
    "status": "InTransit",
    "statusSummary": "Moving through network",
    "expectedDeliveryAt": "2026-08-20T00:00:00.000Z",
    "lastEventAt": "2026-08-17T14:22:00.000Z",
    "lastEventDescription": "Arrived at USPS facility",
    "deliveredAt": null
  }
}
```

A Lead with no sample lines and no USPS tracking row looks the same except:

```json
"sampleProducts": [],
"shipment": null
```

### Lead fields

| Field                    | Type              | Nullable | Description                                                                                          |
| ------------------------ | ----------------- | :------: | ---------------------------------------------------------------------------------------------------- |
| `id`                     | string (`cuid`)   |    no    | Stable primary identifier. Never reused.                                                             |
| `organizationId`         | string (`cuid`)   |    no    | Tenant id. Matches `organization.id` from `/api/v1/me`.                                              |
| `status`                 | string            |    no    | Lead Status. Defaults to `"New"` when unset in storage. See [picklists](#picklists).                 |
| `salutation`             | string            |   yes    | See picklists.                                                                                       |
| `firstName`              | string            |   yes    |                                                                                                      |
| `lastName`               | string            |   yes    |                                                                                                      |
| `company`                | string            |   yes    |                                                                                                      |
| `title`                  | string            |   yes    | Job title, not honorific.                                                                            |
| `website`                | string            |   yes    | Free text; not necessarily a valid URL.                                                              |
| `description`            | string            |   yes    | Free text. May contain newlines.                                                                     |
| `ownerId`                | string (`cuid`)   |    no    | User id of the owner. Not a foreign key that is guaranteed to resolve.                               |
| `owner`                  | object            |    no    | Always present. If the user row is missing, `id` is still `ownerId` and the other fields are `null`. |
| `owner.id`               | string (`cuid`)   |    no    |                                                                                                      |
| `owner.name`             | string            |   yes    | Display name.                                                                                        |
| `owner.alias`            | string            |   yes    | Short name used in the UI.                                                                           |
| `owner.email`            | string            |   yes    |                                                                                                      |
| `rating`                 | string            |   yes    | See picklists.                                                                                       |
| `phone`                  | string            |   yes    | Free-text phone number; format is not normalised.                                                    |
| `email`                  | string            |   yes    |                                                                                                      |
| `country`                | string            |   yes    | Free text (UI uses a country picklist). Not an ISO code.                                             |
| `street`                 | string            |   yes    |                                                                                                      |
| `postalCode`             | string            |   yes    |                                                                                                      |
| `city`                   | string            |   yes    |                                                                                                      |
| `state`                  | string            |   yes    | Free text (UI uses country-dependent state/province options).                                        |
| `numberOfEmployees`      | integer           |   yes    |                                                                                                      |
| `annualRevenue`          | string (decimal)  |   yes    | Prisma `Decimal` as a JSON string. No currency code is returned.                                     |
| `leadSource`             | string            |   yes    | See picklists.                                                                                       |
| `industry`               | string            |   yes    | See picklists.                                                                                       |
| `sampleRequestedDate`    | string (ISO 8601) |   yes    | When a sample was requested.                                                                         |
| `sampleStatus`           | string            |   yes    | Where the sample request has reached. See picklists.                                                 |
| `courier`                | string            |   yes    | Carrier chosen on the Lead. See picklists. Only **USPS** creates a `shipment` row.                   |
| `trackingNumber`         | string            |   yes    | Tracking number stored on the Lead (any courier).                                                    |
| `deliveryDate`           | string (ISO 8601) |   yes    | Delivery timestamp. Written by the USPS poller when status is Delivered; also editable for other couriers. |
| `convertedAt`            | string (ISO 8601) |   yes    | Set when the Lead is converted. `null` means not converted.                                          |
| `convertedAccountId`     | string (`cuid`)   |   yes    | Account created/linked by conversion. The Account itself is not a public API resource.               |
| `convertedContactId`     | string (`cuid`)   |   yes    | Contact created/linked by conversion.                                                                |
| `convertedOpportunityId` | string (`cuid`)   |   yes    | Opportunity created by conversion, if any.                                                           |
| `createdById`            | string (`cuid`)   |    no    | User id. No nested user object.                                                                      |
| `updatedById`            | string (`cuid`)   |    no    | User id. No nested user object.                                                                      |
| `createdAt`              | string (ISO 8601) |    no    |                                                                                                      |
| `updatedAt`              | string (ISO 8601) |    no    | Changes on every Lead row write. Use it for incremental sync and for ordering concurrent webhook events. |
| `sampleProducts`         | array             |    no    | Sample lines, ordered by `displayOrder` then created time. Never `null`.                             |
| `shipment`               | object            |   yes    | Live USPS tracking row, or `null` when none exists.                                                  |

### `sampleProducts[]` fields

`totalPrice` is derived server-side as `quantity * unitPrice` when lines are saved in CRM.

| Field          | Type             | Nullable | Description                                                                 |
| -------------- | ---------------- | :------: | --------------------------------------------------------------------------- |
| `id`           | string (`cuid`)  |    no    | Sample line id.                                                             |
| `productId`    | string (`cuid`)  |    no    | Product id.                                                                 |
| `quantity`     | string (decimal) |    no    | Stored `Decimal(18, 4)`. JSON string, typically up to 4 fractional digits.  |
| `unitPrice`    | string (decimal) |    no    | Stored `Decimal(18, 2)`. JSON string, typically 2 fractional digits.        |
| `totalPrice`   | string (decimal) |    no    | Stored `Decimal(18, 2)`. JSON string.                                       |
| `description`  | string           |   yes    | Line note.                                                                  |
| `displayOrder` | integer          |    no    | 0-based order in the sample.                                                |
| `product`      | object           |   yes    | Trimmed Product, or `null` if the relation is missing.                      |

### `sampleProducts[].product` fields

| Field              | Type             | Nullable | Description                                      |
| ------------------ | ---------------- | :------: | ------------------------------------------------ |
| `id`               | string (`cuid`)  |    no    |                                                  |
| `name`             | string           |    no    | Display name. Not unique.                        |
| `family`           | string           |   yes    |                                                  |
| `productCode`      | string           |   yes    |                                                  |
| `sku`              | string           |   yes    | Not guaranteed unique in this payload.           |
| `category`         | string           |   yes    | Free-text category name, not a nested object.    |
| `active`           | boolean          |    no    | Always a boolean (`false` if unset).             |
| `description`      | string           |   yes    |                                                  |
| `upcGtin`          | string           |   yes    | UPC or GTIN.                                     |
| `imageLink`        | string           |   yes    | External image URL. `null` when unset (not `""`). |
| `price`            | string (decimal) |   yes    | Catalogue selling price as a JSON string.        |
| `productType`      | string           |   yes    |                                                  |
| `collectionName`   | string           |   yes    |                                                  |
| `manufacturerName` | string           |   yes    |                                                  |

### `shipment` fields

Present only when a `ShipmentTracking` row exists for this Lead. CRM creates that row
**only for USPS**. A Lead with `courier` `UPS` / `FedEx` / `DHL` / `Other` still exposes
`courier` and `trackingNumber` on the Lead itself, but `shipment` is `null`.

| Field                 | Type              | Nullable | Description                                                         |
| --------------------- | ----------------- | :------: | ------------------------------------------------------------------- |
| `id`                  | string (`cuid`)   |    no    | Tracking row id.                                                    |
| `carrier`             | string            |    no    | Carrier on the tracking row (`USPS` when created by CRM).           |
| `trackingNumber`      | string            |    no    |                                                                     |
| `status`              | string            |    no    | Poller status — see [shipment statuses](#shipment-statuses).        |
| `statusSummary`       | string            |   yes    | Latest summary text from USPS.                                      |
| `expectedDeliveryAt`  | string (ISO 8601) |   yes    |                                                                     |
| `lastEventAt`         | string (ISO 8601) |   yes    |                                                                     |
| `lastEventDescription`| string            |   yes    |                                                                     |
| `deliveredAt`         | string (ISO 8601) |   yes    | Set when USPS reports delivery.                                     |

### Picklists

These are the **current CRM UI picklists** (`src/lib/crm-metadata/options.ts`). The public
API stores **free strings**. CRM validates them when staff save a Lead in the product;
the public read API does not re-validate.

`"--None--"` is a **UI sentinel** for "no value". Unset fields in this API are JSON
`null`. You should never need to persist `"--None--"`. If you ever see that string, treat
it as unset.

New picklist values may be added. Treat an unrecognised string as a valid value rather
than failing the integration.

#### Lead Status (`status`)

`New`, `Contacted`, `Nurturing`, `Sample requested`, `Sample rejected`, `Qualified`,
`Unqualified`

#### Sample Status (`sampleStatus`)

`Need shipping`, `Shipped`, `Follow ups due`, `Converted`, `No interest`

#### Rating (`rating`)

`Hot`, `Warm`, `Cold`

#### Lead Source (`leadSource`)

`Advertisement`, `Employee Referral`, `External Referral`, `Partner`, `Public Relations`,
`Seminar - Internal`, `Seminar - Partner`, `Trade Show`, `Web`, `Word of mouth`, `Other`

#### Industry (`industry`)

`Agriculture`, `Apparel`, `Banking`, `Biotechnology`, `Chemicals`, `Communications`,
`Construction`, `Consulting`, `Education`, `Electronics`, `Energy`, `Engineering`,
`Entertainment`, `Environmental`, `Finance`, `Food & Beverage`, `Government`,
`Healthcare`, `Hospitality`, `Insurance`, `Machinery`, `Manufacturing`, `Media`,
`Not For Profit`, `Other`, `Recreation`, `Retail`, `Shipping`, `Technology`,
`Telecommunications`, `Transportation`, `Utilities`

#### Salutation (`salutation`)

`Mr.`, `Ms.`, `Mrs.`, `Dr.`, `Prof.`, `Mx.`

#### Courier (`courier`)

`USPS`, `UPS`, `FedEx`, `DHL`, `Other`

### Shipment statuses

When `shipment` is present, `shipment.status` is the value written by the USPS poller
today (`src/lib/usps-status.ts`):

`Pending`, `InTransit`, `OutForDelivery`, `Alert`, `Delivered`, `Returned`, `Expired`,
`Failed`

These are **not** UI picklists on the Lead. New values may appear; ignore ones you don't
handle.

### Fields deliberately not exposed

Omitted by design from the public Lead:

| Omitted                                         | Why it is hidden                                      |
| ----------------------------------------------- | ----------------------------------------------------- |
| `sampleRequestedNotificationId`                 | Internal sample-reminder bookkeeping                  |
| Activity (tasks, events, emails)                | Not part of this API                                  |
| Files / attachments                             | Not part of this API                                  |
| Campaign memberships                            | Not part of this API                                  |
| Sample-line `organizationId`, `leadId`, timestamps | Internal row metadata                              |
| Product cost, MAP, MSRP, stock, PO App ids, verification flags, manufacturer region/email/phone | Not in the public product trim |
| Shipment notification ids (`deliveredNotificationId`, `postDeliveryNotificationId`, `alertNotificationId`) | Internal notification guards |
| Shipment poller internals (`attemptCount`, `failureCount`, `lastPolledAt`, `nextPollAt`, `lastError`) | Operational state |

If you need something that isn't here, ask; adding a field is a backwards-compatible
change.

---

## 9. Integration recipes

### Full catalogue sync

Walk the cursor until `nextCursor` is `null`. Upsert by `id` — the sort key can shuffle
while you page.

```js
const BASE = "https://crm.example.com/api/v1";

async function* allLeads(token, filters = {}) {
  let cursor;

  for (;;) {
    const qs = new URLSearchParams({ ...filters, limit: "100" });
    if (cursor) qs.set("cursor", cursor);

    const res = await fetch(`${BASE}/leads?${qs}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1000));
      continue; // same cursor again
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`${res.status} ${body?.error?.code ?? "unknown"}`);
    }

    const { data } = await res.json();
    yield* data.items;

    if (!data.nextCursor) return;
    cursor = data.nextCursor;
  }
}

for await (const lead of allLeads(process.env.CRM_TOKEN)) {
  await upsertIntoMyStore(lead);
}
```

### Incremental sync

Keep a full copy fresh by asking only for what changed. Overlap the window slightly so
nothing slips through between runs.

```js
const OVERLAP_MS = 60_000; // re-fetch the last minute to absorb clock skew

async function incrementalSync(token, lastRunAt) {
  const since = new Date(lastRunAt.getTime() - OVERLAP_MS).toISOString();
  const startedAt = new Date();

  for await (const lead of allLeads(token, { updatedSince: since })) {
    await upsertIntoMyStore(lead); // idempotent: safe to see a Lead twice
  }

  return startedAt; // persist as the next run's lastRunAt
}
```

Points that matter:

- `updatedSince` is **inclusive** (`>=`), so a Lead updated exactly on the boundary is
  returned. Combined with the overlap, expect to re-process a few unchanged Leads each
  run — make your upsert idempotent.
- Record the timestamp from **before** the run starts, not after, so changes made during
  the run are picked up next time.
- Combine `updatedSince` with `cursor` the same way as a full sync when a window contains
  more than `limit` rows.
- Deletions are invisible to this method — a deleted Lead simply stops appearing.
  Subscribe to `lead.deleted` if you need to remove rows, or periodically reconcile with
  a full sync.
- **USPS in-transit updates** often change only the nested `shipment` row and do **not**
  bump Lead `updatedAt`. Delivery (`deliveryDate` written onto the Lead) does bump
  `updatedAt`. For live tracking between those points, re-`GET /leads/{id}` or wait for
  delivery / another Lead edit. See [What does not emit an event](#what-does-not-emit-an-event).

### Choosing between polling and webhooks

| Need                                         | Approach                                                      |
| -------------------------------------------- | ------------------------------------------------------------- |
| React within seconds to Lead edits           | Webhooks                                                      |
| Keep a warehouse/BI copy fresh hourly        | Incremental sync (`updatedSince` + cursor)                    |
| Track USPS status between Lead saves         | Re-GET the Lead; poller writes do not emit webhooks           |
| Guarantee eventual consistency               | Webhooks **plus** a nightly incremental sync as a safety net  |

The last row is the recommended production setup: webhooks for latency, a periodic sync
to repair anything a webhook failed to deliver.

---

## 10. Webhooks

### How it works

1. An organization admin registers **one** HTTPS URL in **Setup → API Access** and enables
   deliveries. There is no per-event subscription — an enabled endpoint receives every
   Lead event below.
2. CRM generates a **signing secret** (`whsec_…`) the first time a URL is saved, displayed
   once.
3. When a subscribed event occurs, CRM `POST`s a signed JSON body to your URL.
4. Your endpoint verifies the signature and responds `2xx`.
5. If it doesn't, CRM retries with backoff for about nine hours.

### Endpoint requirements

| Requirement | Detail                                                                                                                                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method      | `POST` — your route must accept it.                                                                                                                                                 |
| Scheme      | **HTTPS in production.** Plain HTTP is allowed only when CRM itself is not running in production. `localhost` and private/loopback IP ranges (`10.x`, `192.168.x`, `172.16–31.x`, `127.x`, `169.254.x`, `0.0.0.0`, IPv6 ULA/link-local/`::1`) are rejected at registration time. URLs may not include credentials (`user:pass@`). |
| Response    | Any `2xx`.                                                                                                                                                                          |
| Timeout     | **10 seconds.** Slower responses are aborted and treated as failures.                                                                                                               |
| Redirects   | **Not followed.** A `3xx` counts as a failure — register the final URL.                                                                                                             |
| Body        | Read the **raw bytes** before parsing; you need them to verify the signature.                                                                                                       |

### Request headers

| Header             | Example                   | Purpose                                                                                  |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------------------- |
| `Content-Type`     | `application/json`        |                                                                                          |
| `User-Agent`       | `CRM-Webhooks/1.0`        | Identifies the sender.                                                                   |
| `X-CRM-Event`      | `lead.updated`            | Event name. Also present in the body.                                                    |
| `X-CRM-Delivery`   | `clyk2delexample00000001` | **Delivery id — identical across every retry of the same event.** Use it to deduplicate. |
| `X-CRM-Timestamp`  | `1785657600`              | Unix seconds when the signature was computed.                                            |
| `X-CRM-Signature`  | `t=1785657600,v1=9f86d0…` | HMAC signature — see below.                                                              |

There is no webhook-endpoint id header: each organization has a single URL.

### Verifying the signature

**This is mandatory.** Without it, anyone who learns your URL can post fake events.

The signed string is `<timestamp>.<raw request body>`, and the signature is its
HMAC-SHA256 keyed with your endpoint secret, hex-encoded.

This is the **same algorithm** as PO App `X-PO-Signature` (only the header names differ).
Copy-paste verifiers in Python and PHP are in [docs/PO-API.md](PO-API.md) §10 — pass
`X-CRM-Signature` instead of `X-PO-Signature`.

`X-CRM-Signature` is a comma-separated list of `key=value` pairs:

```
t=1785657600,v1=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

- `t` — Unix seconds, identical to `X-CRM-Timestamp`.
- `v1` — the hex HMAC. Future schemes would add `v2`, so **match on the key name** rather
  than assuming position.

Verification steps:

1. Parse `t` and `v1`.
2. Reject if `|now − t|` exceeds your tolerance — **300 seconds** is the window CRM
   itself uses. This is what stops replay attacks.
3. Compute `HMAC_SHA256(secret, "<t>.<raw body>")` and hex-encode it.
4. Compare with `v1` using a **constant-time** comparison.

> **Verify against the raw body.** Parsing JSON and re-serialising it changes the bytes
> (key order and whitespace are not preserved) and the signature will never match. In
> Express use `express.raw()`; in Next.js use `await request.text()`; in Django use
> `request.body`; in Rails use `request.raw_post`.

#### Node.js / TypeScript

This matches `src/lib/public-api/webhook-signature.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  { now = Date.now(), toleranceSeconds = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS } = {}
) {
  if (!signatureHeader || !secret) return false;

  const parts = new Map(
    signatureHeader.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")] as const;
    })
  );

  const timestamp = Number(parts.get("t"));
  const provided = parts.get("v1");
  if (!Number.isFinite(timestamp) || !provided) return false;
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(provided, "utf8");
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}
```

### Payload envelope

Every delivery has the same outer shape:

```json
{
  "id": "clyk2delexample00000000001",
  "event": "lead.updated",
  "createdAt": "2026-08-17T12:00:00.000Z",
  "organizationId": "clyk2orgexample00000000001",
  "data": {}
}
```

| Field            | Type              | Description                                                                      |
| ---------------- | ----------------- | -------------------------------------------------------------------------------- |
| `id`             | string (`cuid`)   | Delivery id — same value as `X-CRM-Delivery`, stable across retries.             |
| `event`          | string            | Event name — same value as `X-CRM-Event`.                                        |
| `createdAt`      | string (ISO 8601) | When the event was queued, **not** when this attempt was sent.                   |
| `organizationId` | string (`cuid`)   | The organization the event belongs to. Matches `organization.id` from `/api/v1/me`. |
| `data`           | object            | Event-specific body — see below.                                                 |

> **JSON key order is not stable.** The payload round-trips through the database. Parse
> by name; never rely on ordering or on byte-for-byte equality between deliveries.

### Events

| Event             | `data`                                                                                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lead.created`    | The complete [Lead object](#8-the-lead-object).                                                                                                                                                       |
| `lead.updated`    | The complete Lead object **after** the change. Previous values are not included.                                                                                                                      |
| `lead.converted`  | The complete Lead object **after** conversion (`convertedAt` and converted record ids populated). Conversion does **not** also emit `lead.updated`.                                                   |
| `lead.deleted`    | `{ "id", "firstName", "lastName", "company", "email", "deletedAt" }` — identifiers only, since the Lead no longer exists. Converted Leads cannot be deleted in CRM, so this event is for open Leads. |
| `webhook.test`    | `{ "message": "Webhook test from CRM", "sentAt": "<ISO 8601>" }`. Sent only by **Send test** in Setup; never emitted by real activity. Ignore it in production logic, but do return `2xx`.           |

`lead.deleted` example:

```json
{
  "id": "clyk2delexample00000000002",
  "event": "lead.deleted",
  "createdAt": "2026-08-17T12:05:00.000Z",
  "organizationId": "clyk2orgexample00000000001",
  "data": {
    "id": "clyk2leadexample00000000001",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "company": "Analytical Engines",
    "email": "ada@example.com",
    "deletedAt": "2026-08-17T12:05:00.000Z"
  }
}
```

`webhook.test` example:

```json
{
  "id": "clyk2delexample00000000003",
  "event": "webhook.test",
  "createdAt": "2026-08-17T12:06:00.000Z",
  "organizationId": "clyk2orgexample00000000001",
  "data": {
    "message": "Webhook test from CRM",
    "sentAt": "2026-08-17T12:06:00.000Z"
  }
}
```

Events that **do** fire today (application writes, not this public API):

- Lead create in the CRM UI / records API, and marketing-page form submissions → `lead.created`
- Lead save, sample-product line add/edit/delete, and owner-change workflows → `lead.updated`
- Lead conversion → `lead.converted`
- Lead delete → `lead.deleted`

### What does not emit an event

- **`sampleRequestedNotificationId` writes.** Internal sample-reminder bookkeeping does
  not enqueue a webhook.
- **USPS poller updates**, including `deliveryDate` copied onto the Lead when a package
  is delivered and in-transit changes to `shipment.*`. Use `GET /api/v1/leads?updatedSince=…`
  for `deliveryDate` (that write bumps Lead `updatedAt`). For intermediate tracking,
  re-fetch the Lead by id — those shipment-row writes do not bump Lead `updatedAt`.
- **Bulk database maintenance.** Direct data fixes applied by the CRM team bypass the
  application layer.

### Idempotency and ordering

- **Deliveries are at-least-once.** A receiver that times out after doing its work will
  still be retried. Deduplicate on `X-CRM-Delivery`, or make your handler naturally
  idempotent (upsert by Lead `id`).
- **Order is not guaranteed.** Two rapid edits to the same Lead may arrive in either
  order, and a retry of an older event can land after a newer one. When two events
  concern the same Lead, **trust the one with the later `data.updatedAt`** and discard
  the older. For `lead.deleted`, compare `data.deletedAt` against your stored
  `updatedAt`.
- **Respond fast, work later.** Acknowledge with `2xx` immediately and process
  asynchronously if your handler could exceed the 10-second timeout. A slow `200` is
  treated as a failure and retried, which usually makes the backlog worse.

### Retries and auto-disable

A delivery that fails — non-2xx, redirect, timeout, connection error, or TLS failure — is
retried on this schedule:

| Attempt | Sent after the previous failure   |
| :-----: | --------------------------------- |
|    1    | immediately when the event occurs |
|    2    | ~1 minute                         |
|    3    | ~5 minutes                        |
|    4    | ~30 minutes                       |
|    5    | ~2 hours                          |
|    6    | ~6 hours                          |

Six attempts spanning roughly **nine hours**. After the last one the delivery is marked
`failed` and stops automatically.

**Auto-disable:** an endpoint that accumulates **20 consecutive failed attempts** — counted
across deliveries, so several events retrying will reach it — is disabled
(`webhookEnabled = false`) and stops receiving new events. Any **successful** delivery
resets the counter to zero. Changing the URL, rotating the signing secret, or saving the
webhook as disabled also clears the counter. An admin must tick **Enable webhook
deliveries** again in Setup after an auto-disable.

If your receiver is going down for planned maintenance longer than a few hours, ask an
admin to disable the endpoint first and re-enable it afterwards — that avoids the
auto-disable and the retry storm.

There is **no public delivery log or manual replay** in this CRM (unlike PO App's Recent
deliveries). Setup shows last-delivery time and the last error string.

### Testing your receiver

1. **Use Send test.** Setup → API Access → **Send test** sends a real `webhook.test`
   event through the full signing and delivery path, then reports the HTTP status it got
   back. The test can be sent even if deliveries are not yet enabled, as long as a URL
   and secret exist.
2. **Local development.** Private and loopback addresses are rejected, so expose your
   local server through an HTTPS tunnel (ngrok, Cloudflare Tunnel) and register the
   tunnel URL. HTTP to a public host is allowed only when CRM `NODE_ENV` is not
   `production`.
3. **Check last error.** Failed deliveries surface `webhookLastError` on the Setup page.

### Rotating a signing secret

Admins can **Rotate secret** from Setup. The new value is shown once and takes effect
immediately: every delivery signed after that moment uses it, **including pending retries
of events queued before the rotation**. Only requests already on the wire were signed
with the old secret.

To rotate without rejecting events, have your receiver accept **either** secret during the
changeover — try the new one, fall back to the old — then remove the old one once a test
delivery succeeds.

---

## 11. Reference receiver

A complete, production-shaped Express receiver:

```js
import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

const app = express();
const SECRET = process.env.CRM_WEBHOOK_SECRET;
const TOLERANCE_SECONDS = 300;

// Raw body is required for signature verification.
app.post("/hooks/crm-leads", express.raw({ type: "application/json" }), (req, res) => {
  const rawBody = req.body.toString("utf8");

  if (!verify(rawBody, req.get("x-crm-signature"), SECRET)) {
    return res.status(401).send("invalid signature");
  }

  const event = JSON.parse(rawBody);

  // Acknowledge first — the sender times out after 10 seconds.
  res.status(200).json({ received: true });

  // Then do the work, out of band.
  handle(event).catch((error) => {
    console.error("[crm-webhook] handler failed", event.id, error);
  });
});

const seen = new Set(); // use Redis or a table in production

async function handle(event) {
  if (seen.has(event.id)) return; // at-least-once delivery
  seen.add(event.id);

  switch (event.event) {
    case "lead.created":
    case "lead.updated":
    case "lead.converted":
      await upsertLead(event.data); // key on data.id, guard with data.updatedAt
      break;
    case "lead.deleted":
      await removeLead(event.data.id);
      break;
    case "webhook.test":
      console.log("[crm-webhook] test event received");
      break;
    default:
      console.warn("[crm-webhook] unknown event", event.event); // forwards-compatible
  }
}

function verify(rawBody, header, secret) {
  if (!header) return false;

  const parts = new Map(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    })
  );

  const timestamp = Number(parts.get("t"));
  const provided = parts.get("v1");
  if (!Number.isFinite(timestamp) || !provided) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

app.listen(3000);
```

---

## 12. Troubleshooting

| Symptom                                              | Likely cause                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `401 UNAUTHENTICATED` on every request               | Header isn't exactly `Authorization: Bearer crm_…`, the token was regenerated/revoked, or a newline/quote was copied with the value. Confirm with `GET /api/v1/me`. |
| `403 FORBIDDEN` with "This organization is not available." | The organization is suspended.                                                                                                                               |
| `404` with `code: "FORBIDDEN"` for a Lead you can see in the UI | The token belongs to a **different organization**, or you expected `code: "NOT_FOUND"`. Check `organization.id` from `/api/v1/me`. Branch on HTTP 404.  |
| `400 VALIDATION_ERROR` on the list                   | `limit` outside 1–100, `converted` not exactly `true`/`false`, `search` over 200 chars, or `updatedSince` not a parseable date.                                    |
| `500 INTERNAL_ERROR` while paging                    | `cursor` is not an existing Lead id. Restart without `cursor`.                                                                                                     |
| Browser request fails with a CORS error              | Expected — the API is server-to-server only and sends no CORS headers. Proxy it through your own backend; never expose the token to a browser.                     |
| Signature never verifies                             | You're hashing a re-serialised body instead of the raw bytes; or hashing the body alone instead of `<timestamp>.<body>`; or comparing against `t` instead of `v1`. |
| Signature verifies locally but fails in production   | A body-parser middleware is consuming the stream before your handler. Mount the raw parser on the webhook route specifically.                                      |
| Webhooks stopped arriving                            | The endpoint was auto-disabled after 20 consecutive failures. Check **Setup → API Access**, fix the receiver, then re-enable.                                      |
| Duplicate events                                     | Normal — delivery is at-least-once. Deduplicate on `X-CRM-Delivery`.                                                                                                |
| Events arrive out of order                           | Normal and not guaranteed. Resolve with `data.updatedAt`.                                                                                                          |
| `shipment` is `null` but the Lead has a tracking number | Only USPS creates a tracking row. UPS/FedEx/DHL/Other store `courier` + `trackingNumber` on the Lead alone.                                                   |
| Tracking status never arrives as a webhook           | By design — the USPS poller does not emit events. Poll `updatedSince` for `deliveryDate`, or `GET` the Lead for live `shipment`.                                   |
| `"--None--"` in a picklist field                     | UI sentinel that slipped through. Treat as unset; the API's normal representation is `null`.                                                                       |
| Money fields are strings                             | Expected — Prisma `Decimal` JSON. Parse as decimals, not floats.                                                                                                   |

When reporting a problem to the CRM team, include the **`organization.id`** from
`GET /api/v1/me` and, for webhook issues, the **`X-CRM-Delivery`** id. Both are safe to
share — neither reveals a secret.

---

## 13. Operations

_This section is for the team running CRM, not for external consumers._

### Environment variables

| Variable                      | Required    | Purpose                                                                                                                                                                                                 |
| ----------------------------- | :---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEAD_WEBHOOK_CRON_SECRET`    | for retries | Bearer token authorising `POST /api/webhooks/leads/dispatch`. This is an **ops secret**, not an organization API token. Call every **five minutes**. When unset, that route returns `503`.               |
| `INTEGRATION_ENCRYPTION_KEY`  | for webhooks | Passphrase encrypting webhook signing secrets at rest. **Keep stable** — changing it makes existing secrets undecryptable until they are rotated. Falls back to `AUTH_SECRET` when unset.              |

### Retry worker

Newly queued events are dispatched immediately (Next.js `after()`, with a direct
`fetch` fallback). Retries are **not** swept in-process; they depend on:

```bash
curl -X POST https://crm.example.com/api/webhooks/leads/dispatch \
  -H "Authorization: Bearer $LEAD_WEBHOOK_CRON_SECRET"
```

Success (`200`): `{ "ok": true, "considered": n, "delivered": n, "failed": n, "skipped": n }`.
Default batch size is 50 due deliveries. Deliveries are claimed with an atomic
conditional update, so concurrent callers cannot double-send.

This route does **not** use the `/api/v1` error envelope:

| Status | Body                                                      |
| ------ | --------------------------------------------------------- |
| `401`  | `{ "error": "Unauthorized." }`                            |
| `503`  | `{ "error": "Lead webhook scheduling is not configured." }` |
| `500`  | `{ "error": "Unable to dispatch lead webhooks." }`        |

The cron only considers pending rows for **ACTIVE** organizations with
`webhookEnabled: true`.

### Internal management endpoints

Session-authenticated organization **admin** UI (Setup → API Access). Closed to the
public `crm_…` token.

| Endpoint                                         | Purpose                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `GET`/`PUT` `/api/organization/api-access`       | Load / save webhook URL and enabled flag. Secret returned only when first generated.             |
| `POST`/`DELETE` `/api/organization/api-access/token` | Create or regenerate / revoke the organization API token. Plaintext returned only on create/regenerate. |
| `PUT` `/api/organization/api-access/webhook`     | Rotate the signing secret (`{ "rotateSecret": true }`).                                          |
| `POST` `/api/organization/api-access/webhook/test` | Send a `webhook.test` event synchronously.                                                     |

UI: `/lightning/setup/api`.

### Where the code lives

| Path                                         | Responsibility                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/app/api/v1/`                            | Public API route handlers (`me`, `leads`, `leads/[id]`).                                    |
| `src/lib/public-api/auth.ts`                 | Bearer parse, hash lookup, suspended-org check.                                             |
| `src/lib/public-api/token.ts`                | `crm_` / `whsec_` generation and SHA-256 hashing.                                           |
| `src/lib/public-api/lead.ts`                 | List/get query schema and loaders.                                                          |
| `src/lib/public-api/lead-serialize.ts`       | The public Lead shape — **the contract**. Removing a field here is a breaking change.       |
| `src/lib/public-api/emit.ts`                 | Enqueue + immediate dispatch hooks from CRM writes.                                         |
| `src/lib/public-api/webhook-delivery.ts`     | Outbox: enqueue, claim, send, backoff, auto-disable.                                        |
| `src/lib/public-api/webhook-signature.ts`    | Signing and verification.                                                                   |
| `src/lib/public-api/webhook-policy.ts`       | Event names, timeout, attempt/backoff constants.                                            |
| `src/lib/public-api/webhook-url.ts`          | HTTPS / private-address policy.                                                             |
| `src/lib/organization-api-access.ts`         | Setup mutations (token, URL, rotate, test).                                                 |
| `src/app/api/webhooks/leads/dispatch/route.ts` | Cron trigger.                                                                             |
| `src/app/lightning/setup/api/page.tsx`       | Setup → API Access page.                                                                    |
| `prisma/schema.prisma`                       | `OrganizationApiAccess`, `OrganizationWebhookDelivery`.                                     |

### Data retention

`OrganizationWebhookDelivery` rows accumulate — one per event, retained indefinitely,
each holding the full event payload. On a busy organization this table will need a
pruning job.

---

## 14. Versioning

The version lives in the URL path (`/api/v1`). Within `v1`:

**Backwards-compatible changes may ship at any time — your integration must tolerate them:**

- New fields on existing responses.
- New optional query parameters.
- New endpoints.
- New picklist values, shipment statuses, or event types.
- Reworded `message` text in error responses.

**Breaking changes get a new version path (`/api/v2`), with `v1` supported during a
published deprecation window:**

- Removing or renaming a field.
- Changing a field's type or nullability (including changing decimals from strings to numbers).
- Changing the meaning of an existing `code`.
- Removing an endpoint or a query parameter.

To stay compatible: ignore unknown fields, don't depend on JSON key order, branch on
`error.code` (and HTTP status, for the missing-Lead `404`/`FORBIDDEN` pairing) rather
than `message`, and treat unrecognised picklist values as ordinary strings.

### Changelog

| Version | Date       | Change                                                                                          |
| ------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `v1`    | 2026-08-17 | Initial release: read-only Leads with owner, sample products, and USPS shipment; organization API tokens; `lead.created` / `lead.updated` / `lead.converted` / `lead.deleted` webhooks. |
