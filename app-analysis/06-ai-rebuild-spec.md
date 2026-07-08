# AI Rebuild Spec

## Product Summary

Build a Salesforce Lightning-style CRM web application with these modules:

- Home dashboard and onboarding.
- Contacts.
- Accounts.
- Sales workspace: Leads, Contacts, Accounts, Opportunities, Products, Price Books, Calendar, Analytics, Invoices, Video Calls.
- Service workspace: Cases, Contacts, Accounts, Quick Text, Messaging Sessions, Analytics, Knowledge.
- Marketing workspace: marketing activation overview and list email sending.
- Commerce workspace: store setup empty state.
- Subscription workspace: account/billing empty state.

The first screen after login should be a dense app workspace, not a marketing page.

## Required Global Components

Implement these components once and reuse them:

- Trial banner with purchase CTA and countdown.
- Vertical left nav with active state.
- App title/header area with app-specific tabs.
- Console tab strip with closable page tabs.
- Global search overlay with suggestions.
- Header utility buttons for AI assistant, guidance, help, quick settings, notifications, and profile.
- List-view framework.
- Record page framework.
- Modal create/edit framework.
- Activity publisher and timeline.
- File upload/dropzone component.
- Empty-state component.
- In-app guidance card component.

## Suggested Data Model

### Core Objects

Account:

- `id`
- `name` required
- `website`
- `type`
- `description`
- `parentAccountId`
- `ownerId`
- `phone`
- Billing address fields: country, street, postal code, city, state/province
- Shipping address fields: country, street, postal code, city, state/province
- Audit fields: createdBy, createdAt, updatedBy, updatedAt

Contact:

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
- Mailing address fields: country, street, postal code, city, state/province
- Audit fields

Lead:

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
- Address fields: country, street, postal code, city, state/province
- `numberOfEmployees`
- `annualRevenue`
- `leadSource`
- `industry`
- Audit fields

Opportunity:

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
- Audit fields

Case:

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
- Audit fields

Product:

- `id`
- `name` required
- `family`
- `productCode`
- `sku`
- `active`
- `description`

PriceBook:

- `id`
- `name` required
- `active`
- `description`
- `isStandard`
- `validFrom`
- `validTo`

KnowledgeArticle:

- `id`
- `title` required
- `urlName` required
- `bodyRichText`
- `visibleInInternalApp`
- `visibleToCustomer`
- `publicationStatus`
- `validationStatus`
- `articleNumber`
- `publishedAt`
- Audit and archive fields

Other objects:

- `Event`
- `Task`
- `EmailActivity`
- `CallActivity`
- `File`
- `Attachment`
- `QuickText`
- `QuickTextFolder`
- `MessagingSession`
- `Invoice`
- `VideoCall`
- `ListEmail`
- `MarketingStore`

## Relationships

- Account has many Contacts.
- Contact belongs to Account.
- Account has many Opportunities.
- Contact can have many Opportunities.
- Account has many Cases.
- Contact has many Cases.
- Account has many Partners.
- Records have many Files.
- Records have many Notes/Attachments.
- Records have many Activities.
- Product can have Price Book Entries.
- List Email can target Leads and Contacts.
- KnowledgeArticle can be published, assigned, archived, or deleted.

## Required List View Behavior

Every object list should support:

- Named list views and a list view selector.
- Pinned list state.
- Search within current list.
- Record count and last-updated status.
- Row selection and bulk actions when applicable.
- Sortable columns when enough rows/columns exist.
- Disabled column sort message when not applicable.
- Column resize handles.
- Column actions menu.
- Refresh.
- Inline edit when fields support it.
- Charts and filters buttons, with disabled state where unavailable.
- Display modes: Table and Kanban.
- Empty state with creation prompt.

## Required Workflows

Sales:

- Create lead from empty Leads list.
- Import leads/contacts/accounts/opportunities where action exists.
- Add Leads/Contacts to Campaign.
- Send Email to Leads/Contacts.
- Change owner for Leads/Cases.
- Convert or progress leads conceptually through sales records.
- Create Opportunity from list or Account/Contact record.
- Create Product, then continue into Price Book Entry step.
- Create Price Book.
- Use Calendar week view and create Event.

Service:

- Create Case.
- Merge Cases action on case list.
- Printable view on All Open Cases.
- Create and manage Quick Text and folders.
- View Messaging Sessions list.
- Create Knowledge articles with rich text editor.
- Publish, assign, archive, and delete Knowledge articles.

Marketing:

- Activate marketing tools from overview.
- Send list email via layout picker.
- Pick from Sales, Announcement, Newsletter, Rich Text, HTML, or Plain Text layout.
- Preview and continue to compose/send.

Commerce:

- Empty store state.
- `Create Store` flow entry point.

Your Account:

- Empty subscription state.
- `Buy Now` CTA.

## Required Record Page Behavior

Record pages must provide:

- Highlights panel with object type, record name, key fields, and actions.
- Related and Details tabs.
- Duplicate detection panel.
- Inline editable detail fields.
- Owner preview and change owner action.
- Related lists with counts and `New` actions.
- File upload and drag/drop where applicable.
- Activity publisher with Email, New Event, Log a Call, New Task.
- Activity timeline with filters, settings, refresh, expand all, and empty state.

## Visual Requirements

- Use a compact, utilitarian CRM layout.
- Use a dark blue vertical rail, white/gray content panels, Salesforce-like blue action links, and restrained button styling.
- Dense tables and forms should prioritize scan speed over decorative layout.
- Modal dialogs should be centered with dimmed page backdrop.
- Required fields use an asterisk.
- Empty states should include concise explanatory text and a direct action when possible.

## Acceptance Criteria

An AI-built replacement is feature-complete for this analysis when:

- All top-level nav items exist and route to equivalent pages.
- Sales, Service, and Marketing expose their child navigation.
- Every object listed in [03-objects-and-list-views.md](03-objects-and-list-views.md) has a matching list page, actions, search, empty state, and visible columns.
- Contact and Account records reproduce the observed highlights, related lists, details, duplicate panel, and activity timeline.
- New Lead, Contact, Account, Opportunity, Product, Price Book, Case, Knowledge, Event, Quick Text, and List Email flows exist with the fields/actions documented in [04-forms-and-workflows.md](04-forms-and-workflows.md).
- Global search returns records, reports, and list views with object/type context.
- Console tabs can open, switch, and close pages.
- No destructive action happens without confirmation.
- Disabled actions and unavailable features are still visible when observed as visible-disabled in the original app.

## Known Gaps From UI-Only Analysis

- Exact backend metadata, hidden validation rules, permissions, automation, triggers/flows, integrations, and package configuration were not available from the UI-only pass.
- Many visible picklists were opened and documented in [07-field-dictionary-and-picklists.md](07-field-dictionary-and-picklists.md). Very large Salesforce-standard value sets, such as countries and state/province dependencies, should be implemented as complete standard lists even though the UI crawl only sampled their visible dropdown portion.
- Menus for profile, notifications, and quick settings were visible as global shell buttons. A rebuild should include standard CRM utility popovers for them, even though their private account-specific panel contents are not part of this UI reconstruction.
- Some row and column action menus were difficult to open after the workspace accumulated console tabs; implement standard Salesforce-style row actions such as edit, delete, change owner, and view where appropriate.
- The current org had little data, so many list pages were verified through empty-state behavior rather than populated-table behavior.
