# CRM Feature Completion Note

Implemented July 22, 2026.

This note records the deliberate implementation beyond the original read-only Salesforce observations. Historical observation documents remain intact. The obsolete application checkout model and purchase placeholder have been removed; Your Account is now a working identity, workspace, preferences, and security hub.

## Completed CRM Surfaces

- Sales invoices: organization-scoped aggregate CRUD, Decimal calculations, line items, payments, lifecycle enforcement, notifications, PDF generation, SendGrid attachment delivery, and per-recipient provider tracking.
- Durable files and attachments: multipart upload into PostgreSQL-backed binary records, checksums, authenticated tenant-scoped download, related-record validation, replacement-safe metadata, and deletion.
- Messaging Sessions: participant management, inbound/outbound/system transcript entries, waiting/close/reopen lifecycle, related Account/Contact context, provider-backed outbound email when configured, and recorded-only behavior otherwise.
- Video Calls: participants, provider/external meeting links, scheduling validation, start/complete/cancel lifecycle, attendance, recording links, related CRM records, and optional provider-backed invitations.
- Campaigns: CRUD, hierarchy, members, response/conversion metrics, lifecycle transitions, scoped membership updates, notifications, list view, and detail view.
- Products, Price Books, and Sales Commerce: catalog entries, store lifecycle, inventory, promotions, concurrency-safe order numbering, server-side Decimal totals, confirmation/cancellation, reservation, fulfillment, shipment/delivery state, detail views, and integrity restrictions.
- Knowledge: draft/publish/archive/restore lifecycle, internal detail/metrics, customer visibility, public organization/slug routes, anonymous helpful/not-helpful feedback, view counts, and safe plain-text article rendering.
- Core record details: dedicated Lead, Opportunity, Case, Knowledge, List Email, Product, Price Book, Campaign, Messaging Session, Video Call, and Invoice detail routes in addition to existing Account and Contact pages.
- List Email and outbound email observability: SendGrid acceptance is persisted separately from signed delivery events; bounced/dropped/spam/unsubscribe outcomes create CRM notifications and are shown on relevant detail pages.
- Analytics: live standard/custom reports, CSV export, saved report create/update/delete, dashboard create/update/delete, dashboard component cleanup, and immediate Bootstrap state updates.
- Calendar: validated local events, persisted calendar-source assignment and visibility, privacy-aware reads, current date/timezone display, source colors, safe source deletion, and valid iCalendar export.
- Quick Text: create, preview, edit, delete, folders, channel selection, merge-field insertion, and per-user persisted favorites.
- Standard CRM lifecycle integrity: concurrency-safe Case numbers, durable Lead conversion destination links and converted-record immutability, transactional Case merge/re-parenting, field-level server validation, and persisted standard list-view selection/filter behavior.
- Knowledge identity: organization-unique public URL slugs and concurrency-safe article numbers such as `KA-000001`, while preserving existing articles through migration.
- Marketing landing pages: Draft/edit/publish/archive/restore lifecycle, branded public organization/slug forms, configurable fields, tenant-scoped owner and Campaign validation, anonymous validation and duplicate-submit throttling, Web Lead creation, Campaign response attribution, submission history, and notifications.
- Account management: editable alias/avatar, read-only identity-provider fields, active organization and role details, workspace switching, personal preferences, session management, role-aware administration links, and sign-out access.

All dedicated reads and mutations use the active organization context. Aggregate workflows validate related records inside the same organization and use transactions for multi-record financial, inventory, lifecycle, and cleanup operations.

## External Integration Boundaries

- Email is sent only when `SENDGRID_API_KEY` and a verified `SENDGRID_EMAIL` are configured. No provider configuration means the UI records external communication or disables delivery; it never reports a fake send.
- SendGrid event ingestion rejects unsigned requests and is unavailable until `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` is configured. Provider acceptance is not presented as final delivery.
- Recorded invoice payments are externally received money. The CRM does not charge cards or initiate bank transfers.
- Commerce orders track externally collected payment state and fulfillment records. The CRM does not process payment or create carrier shipments; it only reads USPS tracking status for a shipment someone else created.
- USPS tracking is read-only and requires `USPS_CONSUMER_KEY` and `USPS_CONSUMER_SECRET`. Without them, a courier and tracking number are still recorded on Opportunities and fulfillments, but nothing is polled and no delivery notification is raised. Only USPS is polled; other couriers render a tracking link.
- Video calls store validated provider/external links; the CRM does not provision Zoom, Google Meet, or Microsoft Teams rooms without those provider APIs.
- Calendar sources are local CRM calendars. Google, Microsoft, and CalDAV OAuth synchronization are not simulated; `.ics` export is implemented for interoperability.
- PDF generation is local and produces valid invoice PDFs. No e-signature provider is integrated.
- Payment reversal/refund ledgers are intentionally not implemented. Invoices with payments cannot be voided, and payment history cannot be silently deleted.

## Database Migrations

- `20260722000000_complete_sales_invoicing`
- `20260722100000_complete_file_storage`
- `20260722200000_complete_messaging_and_video`
- `20260722300000_complete_campaigns`
- `20260722400000_complete_commerce_catalog`
- `20260722500000_complete_knowledge_portal`
- `20260722600000_add_email_delivery_tracking`
- `20260722700000_complete_calendar_sources`
- `20260722800000_complete_standard_list_views`
- `20260722900000_complete_case_numbering`
- `20260722910000_complete_knowledge_numbering`
- `20260722920000_complete_marketing_forms`
- `20260722930000_remove_subscription_checkout`

These migrations are applied forward with Prisma; no database reset or `db push` shortcut is required. The final migration intentionally drops the obsolete checkout table and any rows it contained.

## Verification

The authenticated `npm run test:usecases` flow covers route rendering, the account hub, tenant isolation, CRUD, invoice totals/lifecycle/PDF, durable files, communications, campaigns, commerce, Knowledge numbering/public feedback, Lead conversion, Case numbering/merge, marketing landing pages and anonymous lead capture, email delivery history, Analytics lifecycle, calendar source assignment, and valid `.ics` output. Focused invoice, email, file, and AI unit tests supplement it.

The in-app browser reaches the real Keycloak Distributor Login screen. Authenticated UI automation therefore requires credentials; authenticated server-rendered page and API coverage is performed by the local signed-session use-case harness.
