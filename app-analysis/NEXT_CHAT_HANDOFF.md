# Next Chat Handoff: Build app-analysis in Next.js

Use this file to continue the active goal from the previous chat.

## Paste This Into The New Chat

```text
I want to continue the active goal from the chat "Build app-analysis in Next.js".

Workspace: /run/media/parsa/projects/robert/crm

Please read app-analysis/NEXT_CHAT_HANDOFF.md first, then read app-analysis/README.md, app-analysis/06-ai-rebuild-spec.md, app-analysis/08-page-state-and-interaction-spec.md, and app-analysis/09-ai-implementation-blueprint.md. Use app-analysis/07-field-dictionary-and-picklists.md when working on fields, picklists, or lookup behavior.

Active goal:
Make sure all the features are fully working and implemented from app-analysis/.
Do not implement trial or plans. Only implement the app logic.

Important constraints:
- Do not discard or reset existing local changes.
- Inspect git status and relevant staged/unstaged diffs before editing.
- Use the existing Next.js, React, Tailwind, Radix UI, Prisma, and PostgreSQL patterns already in the repo.
- Keep the first screen as the CRM workspace, not a landing page.
- The previous build blocker is fixed. Continue with the highest-value remaining app-analysis gaps.
- Run npm run build after meaningful changes, then smoke-check key routes on a fresh dev server if needed.

Current dev note:
- Port 3001 has been used for fresh validation: npm run dev -- -H 0.0.0.0 -p 3001
- Port 3000 is held by an older detached Next process and has repeatedly gone stale after builds.
- Running next build can stale an already-running Next dev manifest; restart the dev server before trusting route checks after a production build.
```

## Current Workspace Summary

This repo is a Next.js CRM rebuild based on the observed Salesforce Lightning Starter-style CRM UI documented in `app-analysis/`.

Tech stack:
- Next.js App Router, React 19, TypeScript.
- Tailwind CSS and Radix UI primitives.
- Prisma with PostgreSQL.
- `docker-compose.yml` provides local PostgreSQL on host port `5433`.
- `.env.example` contains the expected `DATABASE_URL` format.

Key app entry points:
- `src/app/page.tsx` redirects `/` to `/lightning/page/home`.
- `src/app/lightning/[[...slug]]/page.tsx` loads bootstrap data and renders `CrmApp`.
- `src/components/crm/CrmApp.tsx` is the main UI implementation.
- `src/lib/bootstrap.ts` loads real database data when `DATABASE_URL` exists, otherwise fixture data.
- `src/lib/crm-metadata.ts` defines objects, nav, forms, fields, picklists, and list columns.
- `prisma/schema.prisma` defines the CRM data model.
- API routes exist for bootstrap, records, activity, files, workflows, and utility actions.

The `app-analysis/` folder is the source of truth for the target UI:
- `README.md` explains the analysis scope.
- `01-shell-and-navigation.md` through `05-record-pages-and-activity.md` describe observed UI surfaces.
- `06-ai-rebuild-spec.md` is the consolidated product/spec checklist.
- `07-field-dictionary-and-picklists.md` has fields and picklists.
- `08-page-state-and-interaction-spec.md` has detailed state behavior.
- `09-ai-implementation-blueprint.md` has route/component/data implementation guidance.
- `10-raw-observation-log.md` contains raw observations.

## Current Implementation State

The app is substantially implemented. `CrmApp.tsx` includes:
- Left app rail, global header, app nav, and console tabs. The trial purchase banner has intentionally been removed.
- Global search, help/settings/profile/notifications utilities.
- List views with search, sorting, filters, charts, display modes, row actions, selection, import/list actions, list view preferences, and Kanban.
- Record pages for Account and Contact with related lists, details, duplicate handling, hierarchy, file upload, and activity.
- Home, marketing, commerce, account management, analytics, calendar, quick text, knowledge, product wizard, list email, Sales invoice, report builder, and modal workflows.
- Toasts, guidance cards, calendar sources, notification preferences, custom reports/dashboards, app nav preferences, list view preferences, and Agentforce-like utility responses.

Prisma/API coverage includes core objects and workflows:
- Accounts, Contacts, Leads, Opportunities, Cases.
- Products, Price Books, Price Book Entries.
- Events, Tasks, Email/Call activities.
- Files, attachments, quick text, knowledge, list emails, messaging sessions, video calls, and full Sales invoices with line items and payment history.
- Preferences, notifications, guidance, search recents, custom reports/dashboards, and marketing actions.

## Completed Since The Old Handoff

The old handoff's known blocker is resolved:
- `listViewControlItems` exists and the list-view controls modal/menu build.
- The missing `useEffect` dependency warning was fixed.
- Header avatar `<img>` warnings were replaced with `AvatarImage`.
- `npm run build` now passes.

Additional app-analysis progress:
- Sales Invoices are a functioning Sales feature with tenant-scoped CRUD, lifecycle validation, Decimal calculations, concurrency-safe numbering, Product/Price Book defaults, external-payment recording, notifications, detail pages, and valid PDF downloads.
- Record page owner edit actions now route into the `Change Owner` list-action modal for the current record.
- `Change Owner` has a fixture-mode/local fallback so ownership changes still update visible records when no DB workflow rows return.
- Lead `Convert Lead` is implemented in UI and `/api/workflows`, creating/reusing Account, Contact, and optional Opportunity records while updating Lead status.
- Knowledge destructive actions require confirmation, including `Delete Article` and more-action `Delete Draft`.
- Standard record create/edit modals now show an unsaved-changes confirmation before discarding edited fields.
- Product, Event, Quick Text, Knowledge, and List Email special create flows also guard unsaved changes.
- Record activity timeline now groups visible activities by time labels such as `Today`, `Tomorrow`, `Yesterday`, or a date.
- Record page file upload surfaces now show upload progress rows before completed file/attachment rows appear.
- Lookup fields are now search-input comboboxes with filtered results, keyboard selection, selected-record pills, and clear-selection buttons.
- Product `Add to Category` now persists `Product.category`, updates selected Product rows, and is covered by the use-case suite.
- `scripts/crm-usecase-check.mjs` is available through `npm run test:usecases` and exercises the documented routes, action affordances, required validation, metadata, record CRUD, activity/files, list workflows, Knowledge lifecycle, marketing/commerce/utilities, profile/preferences, and disposable delete cleanup.
- Durable file content, Messaging Sessions, Video Calls, Campaigns, Products/Price Books, commerce orders/inventory/promotions/fulfillment, public Knowledge, provider email tracking, saved Analytics lifecycle, calendar source assignment/ICS export, and the missing core detail routes are implemented. See `12-non-subscription-feature-completion.md`.
- SendGrid delivery events are accepted only through the signed webhook route when `SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY` is configured; acceptance, delivery, deferred, bounce, drop, spam, and unsubscribe states are kept distinct.
- Calendar sources are intentionally local. External calendar OAuth/sync is not faked; `.ics` export is available.
- Standard list views now apply their documented filters from `filterName`, Refresh refetches Bootstrap data, Contact birthdays persist, and Quick Text favorites are per-user records.
- Lead conversion destinations and timestamps persist, converted Leads are immutable, Case numbers use a tenant sequence, and Case merge transactionally re-parents related activity/files before closing the secondary Case.
- Knowledge URL names are tenant-unique and article numbers are allocated concurrency-safely.
- Marketing includes real landing-page CRUD/lifecycle, public branded lead forms, Campaign attribution, submission history, and notifications. Public forms are deliberately separate from marketing sender activation.
- The obsolete checkout model and purchase placeholder have been removed. Your Account now provides profile editing, organization context and switching, personal preferences, session access, role-aware administration links, and sign out.

## Git And Verification Status

Last inspected branch/status:

```text
## master
 M app-analysis/NEXT_CHAT_HANDOFF.md
 M package.json
 M prisma/schema.prisma
 M src/app/api/records/[object]/[id]/route.ts
 M src/app/api/records/[object]/route.ts
 M src/app/api/utilities/route.ts
 M src/app/api/workflows/route.ts
 M src/components/crm/CrmApp.tsx
 M src/lib/crm-metadata.ts
?? scripts/
```

Meaning:
- The worktree is intentionally dirty with implementation and verification changes from the app-analysis pass.
- `scripts/crm-usecase-check.mjs` is untracked and contains the reusable use-case verifier.
- Preserve these changes unless explicitly asked to clean them up.

Verification most recently run:

```bash
CRM_BASE_URL=http://127.0.0.1:3003 npm run test:usecases
git diff --check
npm run build
npm run lint
npm run dev -- -H 0.0.0.0 -p 3003
curl -sS -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3003/lightning/page/home'
curl -sS -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3003/lightning/o/Product2/list'
curl -sS -o /dev/null -w '%{http_code}\n' 'http://127.0.0.1:3003/lightning/o/Event/new'
```

Results:
- The latest authenticated `npm run test:usecases` run passed `26/26` checks. It covers the original CRM flows plus standard-view persistence, Lead conversion immutability, Case and Knowledge numbering, Case merge integrity, invoice lifecycle/PDF, durable files, communications, campaigns, commerce, Knowledge feedback, email delivery tracking, Analytics/calendar behavior, marketing landing-page lifecycle, anonymous form submission, Web Lead/Campaign attribution, and cleanup.
- `git diff --check` passed.
- `npm run build` passed.
- `npm run lint` passed with only the expected Next lint deprecation notice.
- Fresh dev server on port `3003` returned `200` for `/lightning/page/home`, `/lightning/o/Product2/list`, `/lightning/o/Contact/list`, `/lightning/o/Event/new`, and `/lightning/o/Case/list`.
- Cleanup audit found zero disposable `codex-usecase-*` records left behind.
- Browser UI verification also covered Contact, Account, Lead, and Opportunity `Import` modals end-to-end with disposable records, plus Account `Save & New` keeping the modal open and clearing the required name field. All browser-created records and notifications were cleaned up.
- Browser UI verification covered List Email layout preview, `Select & Continue`, compose preview, `Send`, persisted `ListEmail.status = "Sent"`, and cleanup of the created record.
- Browser UI verification covered Quick Text name/message entry, merge object/field selection, `{!Contact.FirstName}` insertion, moving `Event` into selected channels, preview, save, persisted `channels`/`mergeFields`, and cleanup of the created record plus notification.
- Browser UI verification covered Lead conversion from a filtered Lead list: the conversion modal defaulted account/status/opportunity fields, `Convert Lead` created the Account, Contact, Opportunity, and notification, persisted the converted Lead status, and all disposable conversion records were cleaned up.
- Browser UI verification covered Contact create/edit with lookup: the Contact modal accepted typed First/Last Name values, the Account lookup searched and selected `Robert`, save persisted `accountId = "acc-robert"`, record edit updated Phone on the record page and in Prisma, and the disposable Contact was cleaned up.
- Browser UI verification covered Knowledge destructive confirmation: a disposable draft article was filtered to a single-row Knowledge list, `Delete Article` opened a confirmation dialog with the affected-record count and no deletion before confirmation, `Cancel` closed it while leaving the article visible, and the disposable article was cleaned up through Prisma. The final delete mutation is covered by `npm run test:usecases`.
- Browser upload verification is blocked by the current browser automation wrapper because it cannot use native file chooser APIs and does not expose `File`/`Event` constructors for a faithful synthetic file input/drop event. Upload remains covered by `npm run test:usecases` and `FileDropzone`/`/api/files` inspection, but it is not browser-proven in this pass.

Older validation commands kept for reference:

```bash
git diff --check
npm run build
npm run dev -- -H 0.0.0.0 -p 3001
curl -sS -o /dev/null -w 'Account %{http_code}\n' 'http://127.0.0.1:3001/lightning/o/Account/list'
curl -sS -o /dev/null -w 'ContactRecord %{http_code}\n' 'http://127.0.0.1:3001/lightning/r/Contact/con-robert/view'
curl -sS -o /dev/null -w 'LeadNew %{http_code}\n' 'http://127.0.0.1:3001/lightning/o/Lead/new'
```

Results:
- `git diff --check` passed.
- `npm run build` passed.
- Fresh dev server on port `3001` returned `200` for Account list, Contact record, and Lead new routes.

Notes:
- Browser interaction checks have been run through the Codex browser plugin for representative list, Event, disabled-control, import, Save & New, List Email, Quick Text, Lead conversion, Contact create/edit with lookup, Knowledge destructive confirmation, and account flows; the reusable suite remains HTTP/API/static rather than a Playwright test.
- After `npm run build`, a previously running Next dev server can return stale manifest `500`s until restarted.

## Recommended Next Steps

1. Run `git status --short --branch` and inspect relevant staged plus unstaged diffs before editing.
2. Keep changes scoped to CRM app logic. Sales invoices and commerce continue to model customer-facing CRM transactions only.
3. Provider expansions should use real APIs and explicit configuration. Do not simulate email delivery, payment processing, carrier fulfillment, video-room provisioning, or external calendar sync.
4. Run the Prisma, TypeScript, focused unit, authenticated use-case, diff, and production-build gates after meaningful changes.
5. Restart the development server after Prisma generation or a production build before trusting route checks.

## Useful Commands

```bash
git status --short --branch
git diff --staged
git diff
git diff --check
npm run build
npm run dev -- -H 0.0.0.0 -p 3001
```

Optional local database setup:

```bash
cp .env.example .env
docker compose up -d
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:seed
```

The app can also fall back to fixture data when `DATABASE_URL` is not configured.
