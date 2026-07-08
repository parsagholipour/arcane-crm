# AI Implementation Blueprint

This blueprint turns the observed Salesforce Lightning CRM into build instructions. Give this file and the rest of `app-analysis/` to an AI builder to produce a functional clone of the visible app.

## Build Target

Build a web app that reproduces the observed CRM surface:

- A logged-in Salesforce Lightning-style CRM workspace.
- Top-level apps: Home, Contacts, Accounts, Sales, Service, Marketing, Commerce, Your Account.
- Object lists with list views, actions, search, filters/charts controls, inline edit affordances, empty states, and row actions.
- Record pages for Account and Contact with highlights, related lists, details, activity, duplicate panel, and upload surfaces.
- Create/edit flows for Account, Contact, Lead, Opportunity, Product, Price Book, Case, Event, Quick Text, Knowledge, and List Email.
- Read-only or placeholder destinations for Analytics, Invoices, Video Calls, Messaging Sessions, Commerce stores, and subscription purchase.

The first screen should be the app workspace, not a marketing landing page.

## Route Map

Use these routes or equivalents:

| Route | Screen |
| --- | --- |
| `/lightning/page/home` | Home dashboard/onboarding |
| `/lightning/app/home` | Home app wrapper |
| `/lightning/app/contacts` | Contacts app default |
| `/lightning/app/accounts` | Accounts app default |
| `/lightning/app/sales` | Sales app default, Leads |
| `/lightning/app/service` | Service app default, Cases |
| `/lightning/app/marketing` | Marketing overview |
| `/lightning/app/commerce` | Commerce empty stores |
| `/lightning/app/your-account` | Subscription empty state |
| `/lightning/o/Contact/list` | Contact list |
| `/lightning/o/Account/list` | Account list |
| `/lightning/o/Lead/list` | Lead list |
| `/lightning/o/Opportunity/list` | Opportunity list |
| `/lightning/o/Product2/list` | Product list |
| `/lightning/o/Pricebook2/list` | Price Book list |
| `/lightning/o/Event/home` | Calendar week view |
| `/lightning/o/Case/list` | Case list |
| `/lightning/o/QuickText/home` | Quick Text manager |
| `/lightning/o/MessagingSession/list` | Messaging Sessions list |
| `/lightning/o/Knowledge__kav/list` | Knowledge list |
| `/lightning/o/ListEmail/list` | List Emails list |
| `/lightning/o/Invoice/list` | Invoices list |
| `/lightning/o/VideoCall/list` | Video Calls list |
| `/lightning/r/Account/{id}/view` | Account record |
| `/lightning/r/Contact/{id}/view` | Contact record |

Modal routes can be implemented as query/hash state or nested routes:

- `/lightning/o/Account/new`
- `/lightning/o/Contact/new`
- `/lightning/o/Lead/new`
- `/lightning/o/Opportunity/new`
- `/lightning/o/Product2/new`
- `/lightning/o/Pricebook2/new`
- `/lightning/o/Event/new`
- `/lightning/o/Case/new`
- `/lightning/o/QuickText/new`
- `/lightning/o/Knowledge__kav/new`
- `/lightning/r/Account/{id}/edit`
- `/lightning/r/Contact/{id}/edit`

## Component Architecture

Implement these reusable components:

| Component | Purpose |
| --- | --- |
| `TrialBanner` | Purchase promo and trial countdown. |
| `GlobalHeader` | Search, utility buttons, profile/notifications. |
| `LeftAppRail` | Top-level app nav. |
| `AppNavBar` | App-specific tabs, More menu, Edit nav items. |
| `ConsoleTabs` | Workspace tabs with close buttons. |
| `ListViewPage` | Object list framework. |
| `ListViewSelector` | Grouped list picker with search and pinned state. |
| `ListToolbar` | List controls, display selector, refresh, charts, filters. |
| `DataGrid` | Rows, columns, sorting, inline edit affordances, row actions. |
| `EmptyState` | Shared empty data state. |
| `RecordPage` | Highlights, related/details tabs, activity area. |
| `HighlightsPanel` | Record title, key fields, actions. |
| `RelatedListCard` | Related records with count and actions. |
| `ActivityPanel` | Email/Event/Call/Task publisher and timeline. |
| `FileDropzone` | Files and Notes/Attachments upload/drop. |
| `ModalShell` | Standard centered create/edit modal. |
| `FormSection` | Sectioned record fields. |
| `LookupField` | Searchable relationship field with selected pill. |
| `PicklistField` | Combobox/listbox field. |
| `DateTimeField` | Date picker plus optional time combobox. |
| `ProductWizard` | Product and price book entry staged flow. |
| `KnowledgeEditor` | Article form with rich text toolbar. |
| `QuickTextEditor` | Snippet editor with merge fields and channel dual-list. |
| `ListEmailWizard` | Layout picker and compose/send flow. |
| `CalendarWeekView` | Event week grid and sidebar. |
| `GuidanceCard` | Contextual in-app guidance. |
| `ToastHost` | Success/error/warning messages. |
| `ConfirmDialog` | Confirmation for destructive actions. |

## Data Model

Use IDs, labels, ownership, timestamps, and relationships. The following model is sufficient for the visible app.

### User

Fields:

- `id`
- `name`
- `alias`
- `avatarUrl`

Seed:

- Name: `Parsa Gholipourjamnani`.
- Alias: `PGhol`.

### Account

Fields:

- `id`
- `name` required
- `website`
- `type`
- `description`
- `parentAccountId`
- `ownerId`
- `phone`
- `billingCountry`
- `billingStreet`
- `billingPostalCode`
- `billingCity`
- `billingState`
- `shippingCountry`
- `shippingStreet`
- `shippingPostalCode`
- `shippingCity`
- `shippingState`
- `createdById`
- `createdAt`
- `updatedById`
- `updatedAt`

Seed:

- Account name: `Robert`.
- Type: `Customer`.
- Owner: current user.

### Contact

Fields:

- `id`
- `salutation`
- `firstName`
- `lastName` required
- `accountId` required
- `title`
- `reportsToContactId`
- `description`
- `ownerId`
- `phone`
- `email`
- `mailingCountry`
- `mailingStreet`
- `mailingPostalCode`
- `mailingCity`
- `mailingState`
- `createdById`
- `createdAt`
- `updatedById`
- `updatedAt`

Seed:

- Salutation: `Mr.`
- First Name: `Rober`
- Last Name: `Antonio`
- Account: `Robert`.
- Owner: current user.

### Lead

Fields:

- `id`
- `status` required, default `New`
- `salutation`
- `firstName`
- `lastName` required
- `company` required
- `title`
- `website`
- `description`
- `ownerId`
- `rating`
- `phone`
- `email`
- `country`
- `street`
- `postalCode`
- `city`
- `state`
- `numberOfEmployees`
- `annualRevenue`
- `leadSource`
- `industry`
- `createdById`
- `createdAt`
- `updatedById`
- `updatedAt`

### Opportunity

Fields:

- `id`
- `name` required
- `accountId` required
- `closeDate` required
- `amount`
- `description`
- `ownerId`
- `stage` required
- `probability`
- `forecastCategory` required
- `nextStep`
- `createdById`
- `createdAt`
- `updatedById`
- `updatedAt`

### Case

Fields:

- `id`
- `caseNumber`
- `status` required, default `New`
- `origin`
- `priority`, default `Medium`
- `ownerId`
- `contactId`
- `accountId`
- `subject`
- `description`
- `sendNotificationEmailToContact`
- `openedAt`
- `closedAt`
- `createdById`
- `createdAt`
- `updatedById`
- `updatedAt`

### Product And Price Book

Product fields:

- `id`
- `name` required
- `family`
- `productCode`
- `sku`
- `active`
- `description`

Price Book fields:

- `id`
- `name` required
- `active`
- `description`
- `isStandard`
- `validFrom`
- `validTo`

Price Book Entry fields for the wizard:

- `id`
- `productId`
- `priceBookId`
- `listPrice`
- `currency`
- `active`

### Event, Task, Email, Call

Event fields:

- `id`
- `subject` required
- `description`
- `startAt` required
- `endAt` required
- `attendeeIds`
- `nameObjectType`
- `nameRecordId`
- `relatedObjectType`
- `relatedRecordId`
- `assignedToId` required
- `location`
- `showTimeAs`
- `allDay`
- `private`

Task fields:

- `id`
- `subject`
- `dueDate`
- `status`
- `priority`
- `ownerId`
- `relatedRecordId`

Email activity fields:

- `id`
- `to`
- `from`
- `subject`
- `body`
- `relatedRecordId`
- `sentAt`

Call activity fields:

- `id`
- `subject`
- `comments`
- `relatedRecordId`
- `completedAt`

### Quick Text

Fields:

- `id`
- `name` required
- `message` required
- `folderId`
- `category`
- `channels`
- `mergeFields`

Folder fields:

- `id`
- `name`
- `ownerId`
- `sharing`

### Knowledge Article

Fields:

- `id`
- `title` required
- `urlName` required
- `summary`
- `bodyRichText`
- `visibleInInternalApp`
- `visibleToCustomer`
- `articleNumber`
- `publishedAt`
- `publicationStatus`
- `validationStatus`
- `totalViewCount`
- `archivedAt`
- `archivedById`
- `createdById`
- `createdAt`
- `updatedById`
- `updatedAt`

### List Email

Fields:

- `id`
- `layoutType`
- `subject`
- `body`
- `recipientType`
- `recipients`
- `status`
- `createdById`
- `createdAt`

### Other Objects

Implement list containers for:

- `MessagingSession`
- `Invoice`
- `VideoCall`
- `File`
- `Attachment`
- `Partner`
- `Store`
- `Report`
- `Dashboard`

These can use minimal fields until deeper workflows are added.

## Picklist Constants

Implement observed picklists exactly. Use `07-field-dictionary-and-picklists.md` as the source of truth.

Minimum required constants:

- Account Type.
- Salutation.
- Lead Status.
- Lead Rating.
- Lead Source.
- Industry.
- Opportunity Stage.
- Case Status.
- Case Origin.
- Case Priority.
- Product Family.
- Event Subject.
- Event Name object type.
- Event Related To object type.
- Quick Text channels.
- List Email layouts.
- Country/state lists.
- 15-minute time slots.

## Page Construction Details

### Home

Build two panels/states:

- Suggestions/onboarding state with cards and `Hide suggestions`.
- Dashboard state with quarterly performance, recent records, tasks, events, key deals, and assistant.

Use empty widgets where the org has no activity.

### Contacts And Accounts Apps

Default to their object list pages:

- Contacts opens `Contacts Recently Viewed`.
- Accounts opens `Accounts Recently Viewed`.

Both should show one seeded row and the action bars documented.

### Sales App

Default to Leads `All Open Leads`:

- Empty list.
- Guidance card.
- Actions: New, Import, Add to Campaign, Send Email, Change Owner.

Sales nav must include Leads, Contacts, Accounts, Opportunities, Products, Price Books, Calendar, Analytics, Invoices, and Video Calls.

### Service App

Default to Cases `All Open Cases`:

- Empty list.
- Actions: New, Change Owner, Merge Cases, Printable View, Assign Label.
- Guidance card about tracking support in one place.

Service nav must include Cases, Contacts, Accounts, Quick Text, Messaging Sessions, Analytics, and Knowledge.

### Marketing App

Before activation:

- Show activation overview.
- CTA: `Activate Marketing`.
- Email CTA: `Send Email`.
- Feature cards/headings.
- List Emails nav item remains accessible.

### Commerce App

Show empty store state:

- `You don't have any stores yet!`
- `Create Store`.

### Your Account

Show subscription state:

- `You haven't subscribed yet`.
- `Buy Now`.

## Required Workflows

### Create Record

For standard create forms:

1. Open modal.
2. Show required legend.
3. Validate required fields.
4. Save creates record and closes.
5. Save & New creates record and resets modal.
6. Cancel closes without changes.
7. Successful save shows toast.

### Edit Record

For Account and Contact:

1. Open edit modal from record action or inline edit.
2. Prepopulate existing values.
3. Show audit/history fields as read-only.
4. Validate required fields.
5. Save updates record and highlights/details/list row.
6. Cancel leaves data unchanged.

### Product Wizard

1. Stage 1: product details.
2. `Next` validates `Product Name`.
3. Stage 2: price book entry.
4. Finish creates product and optional price book entry.
5. Progress indicator advances from 0%.

### List Email Wizard

1. Step 1: layout picker.
2. Tabs: Layout Options and Saved Emails.
3. Layout cards/radios for Sales, Announcement, Newsletter, Rich Text, Create with HTML, Plain Text.
4. `Preview` opens a preview of selected layout.
5. `Select & Continue` moves to compose/recipient step.
6. Compose step should provide subject, body, recipients, preview, send, cancel.

### Knowledge Workflow

1. New article modal with title, URL name, rich body, visibility, details.
2. Save creates draft.
3. List actions allow Publish, Assign, Archive, Delete Article.
4. More actions allow Delete Draft, Restore, Change Owner where applicable.

### Quick Text Workflow

1. New Quick Text modal.
2. Enter name and message.
3. Optionally insert merge fields.
4. Choose folder/category.
5. Move channels between available and selected.
6. Preview.
7. Save.

### Activity Workflow

On Account and Contact:

- `Email` creates/sends an email activity.
- `New Event` opens Event modal with related record prefilled.
- `Log a Call` creates a completed call.
- `New Task` creates a task.
- Timeline updates after each activity.

### File Upload Workflow

1. Click Add Files/Upload Files or drag onto drop zone.
2. Upload progress appears.
3. File count increments.
4. File row appears under Files or Notes & Attachments.

## Visual And Layout Rules

Use a compact CRM design:

- Dark blue vertical rail.
- White and light gray work areas.
- Salesforce-like blue links and primary buttons.
- Dense tables.
- Sectioned forms.
- 8px or smaller card radius.
- No decorative hero/marketing page as the primary experience.
- Button text must fit; use icons for utility buttons where appropriate.
- Required fields use a visible asterisk.
- Modals are centered over a dim backdrop.

Spacing:

- Left rail fixed width.
- Header and banner fixed at top.
- Content areas scroll vertically.
- Data grids should preserve column alignment and row height.
- Record pages use a two-column feel when there is enough width: details/related content plus activity panel.

## Permissions And Disabled States

Implement visible-disabled behavior:

- Some list view controls disabled on system/recent/pinned lists.
- Column sort disabled on empty or insufficient grids.
- Inline edit disabled on Messaging Sessions.
- Destructive actions require confirmation.
- Actions hidden/visible per object as documented; do not add `New` where the inspected object did not show one, such as Invoice and Video Call.

## Seed Data

Minimum seed data for the observed state:

- User:
  - `Parsa Gholipourjamnani`, alias `PGhol`.
- Account:
  - Name `Robert`, Type `Customer`, owner current user.
- Contact:
  - `Mr. Rober Antonio`, Account `Robert`, owner current user.
- Empty lists:
  - Leads.
  - Opportunities.
  - Products.
  - Price Books.
  - Cases.
  - Invoices.
  - Video Calls.
  - Messaging Sessions.
  - Knowledge.
  - List Emails.

Recent records should include the seeded Account and Contact.

## Acceptance Checklist

An implementation is acceptable only if:

- Every file in `app-analysis/` has been followed.
- Every top-level rail item exists and switches app context.
- Every app-specific nav item exists.
- Every object list has documented actions, search, list view selector, toolbar, grid columns, empty states, and row actions.
- Contact and Account record pages match highlights, related lists, details, inline edits, activity, duplicate panel, and upload surfaces.
- All create/edit modals contain the fields, sections, required/default states, buttons, and picklists documented.
- Product, List Email, Quick Text, Knowledge, Event, Calendar, Marketing, Commerce, and Your Account special workflows exist.
- Global search returns records, list views, and reports with object/type context.
- Console tabs can open, switch, overflow into More, and close.
- Disabled states and confirmation modals behave as specified.
- No destructive action occurs without explicit confirmation.
- The app remains usable with the seeded data and with all empty-list states.

## Known Non-UI Dependencies

These cannot be guaranteed from the Chrome UI alone:

- Hidden validation rules.
- Server-side automation and flows.
- Exact Salesforce object permissions.
- Exact profile/permission set setup.
- Full metadata descriptions.
- Full country/state value set.
- Backend APIs, Apex, integrations, or installed packages.

For a production-perfect Salesforce rebuild, export Salesforce metadata and compare it against this UI spec. For a non-Salesforce clone, this UI spec is the implementation source of truth.
