# Sales Invoicing Implementation Note

Implemented July 22, 2026.

Invoices are now a functioning, organization-scoped Sales feature. They remain under the Sales app and are deliberately separate from application subscription billing. `SubscriptionCheckout` and the Your Account subscription surface do not read, create, mutate, or link to Sales invoices.

## Implemented Workflows

- Draft creation and editing with required Account, optional same-Account Opportunity, billing details, dates, currency, purchase order, notes, and terms.
- Add, edit, remove, and reorder line items. Products are optional; active Product and Price Book data can populate descriptions and default prices.
- Server-authoritative Prisma Decimal calculations for quantities, discounts, tax, totals, paid amount, and balance.
- Concurrency-safe per-organization numbers such as `INV-000001`.
- Lifecycle states: Draft, Sent, Partially Paid, Paid, Overdue, and Void, with server-enforced transitions and restrictions.
- Recording externally received payments with method, date, reference, notes, recorder, history, and overpayment protection.
- Sales list views, searchable/sortable/customizable columns, accessible status badges, currency formatting, and invoice detail routing.
- Explicit `Mark as Sent` for invoices delivered outside the CRM, plus optional SendGrid delivery from an editable recipient dialog with the generated PDF attached. Provider email controls are exposed only when delivery is configured.
- Application notifications for creation, email acceptance, payments, paid status, overdue status, and voiding.
- Printable, valid PDF documents containing organization identity, customer billing information, dates, line items, totals, notes, and terms.

## Intentional External-Integration Limits

- `Email Invoice` treats SendGrid API acceptance as Sent. A signed SendGrid Event Webhook records processed, deferred, delivered, bounced, dropped, spam-report, and unsubscribe events per recipient. This tracking requires `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` and a matching SendGrid webhook configuration. `Mark as Sent` does not claim an email was delivered.
- `Record Payment` records money received outside this application. It does not process cards, initiate bank transfers, or move money.
- Payment deletion/reversal is not exposed. Invoices with payments cannot be voided; a future explicit refund/reversal ledger would be required.
- PDF generation is local and complete. No third-party document or e-signature service is used.

The earlier source-observation documents are retained as historical evidence of the original trial UI, including its empty invoice list. This note records the deliberate implementation beyond that observed state.
