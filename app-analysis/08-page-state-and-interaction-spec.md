# Page State And Interaction Spec

This file describes how the app behaves as a system. It should be used together with the field dictionary and object/list documentation when rebuilding the app.

## Global Shell State

The shell is present on every authenticated page:

- Top trial banner.
- Global header.
- Left vertical app rail.
- App-specific horizontal navigation.
- Main workspace.
- Optional console tab strip.
- Optional modal overlay.

### Trial Banner

Persistent top banner:

- Text: `Don't wait: Save 70% now with code STARTER70 | Terms apply.`
- CTA: `Buy Now`.
- Countdown: `Days left in your Trial: 30`.

Behavior:

- Banner stays visible during navigation and while modals are open.
- `Buy Now` routes to the subscription/purchase experience.
- The countdown should be data-driven, not hard-coded, but the observed value is 30.

### Header Utilities

Header buttons:

- `Search...`
- `Agentforce`
- `Guidance Center`
- `Salesforce Help`
- `Quick Settings`
- `Notifications`
- `View profile`

Behavior:

- Buttons are always visible across modules.
- Notifications may show unread count text such as `1 new notifications`.
- Utility panels should open as overlays/popovers without leaving the current workspace.
- The rebuild may use placeholder panels for help/settings/profile if it preserves button presence, placement, and non-destructive behavior.

## Navigation Model

### Left App Rail

The left rail routes between top-level apps:

- Home
- Contacts
- Accounts
- Sales
- Service
- Marketing
- Commerce
- Your Account

State rules:

- Active app is visually highlighted.
- App switch changes the horizontal app navigation and main default page.
- The rail remains fixed while the main content scrolls.

### App Navigation

Each app has a horizontal navigation bar:

- App name.
- App tabs.
- More menu if the tab list overflows.
- `Edit nav items` personalization action.

`Edit nav items` modal:

- Title pattern: `Edit [App Name] App Navigation Items`.
- Top-right: `Cancel and close`.
- Actions: `Add More Items`, `Cancel`, `Save`.
- Contains draggable/reorderable nav entries.
- Includes keyboard reorder instructions.
- Rebuild should allow nav item reorder in the UI layer, even if it persists only locally.

### Console Tabs

The app behaves like a Salesforce console when multiple records/lists are opened:

- Open pages appear as tabs in the top workspace area.
- Accessible tab names may start with `*`, such as `* Robert | Account`.
- Each tab exposes:
  - Main tab label.
  - Secondary `List` button.
  - `Close tab` button.
- A `More` tab appears when there are too many tabs.

State rules:

- Opening a record from a list creates or focuses a record tab.
- Opening child pages can leave previous tabs open.
- Closing a tab returns focus to another open tab.
- Closing should never delete data.

## List View Component

The list view is the most reused object screen in the app.

### Layout Regions

Required regions:

1. Object header with icon and object label.
2. List view selector and current list view name.
3. Pin control.
4. Action bar.
5. Status line.
6. Search current list input.
7. Utility toolbar.
8. Data grid or empty state.

### List View Selector

Behavior:

- Opens a dropdown.
- Contains a search box labeled `Search lists...`.
- Groups views under headings such as `Recent List Views` and `All Other Lists`.
- Shows pinned state in the option label, for example `Recently Viewed (Pinned list)`.
- Selecting a view updates the grid, status line, and action availability.

Observed Contact values:

- `All Contacts`
- `Birthdays This Month`
- `My Contacts`
- `New This Week`
- `Recently Viewed (Pinned list)`
- `Recently Viewed Contacts`

Observed Knowledge values:

- `All Articles`
- `Archived Articles`
- `Draft Articles`
- `Published Articles`
- `Recently Viewed (Pinned list)`

Observed List Email values:

- `All List Emails`
- `My List Emails`
- `Recently Viewed (Pinned list)`

### Pin Control

Behavior:

- Unpinned label: `Pin this list view.`
- Pinned label/state: `This list is pinned.`
- The pinned list view should become the object default for that user/app context.

### Status Line

The status line communicates count, sort, filter, and freshness.

Examples:

- `1 item - Updated a few seconds ago`
- `0 items - Sorted by Name - Filtered by Lead Status - Updated a few seconds ago`
- `0 items - Sorted by Case Number - Filtered by Date/Time Opened/Closed - Updated a few seconds ago`

Behavior:

- Update after refresh, list view change, filter change, search, inline edit, and create/delete.
- Use singular `item` for 1 and plural `items` otherwise.

### Search Within List

Each object has a scoped search input:

| Object | Input name |
| --- | --- |
| Contact | `Contact-search-input` |
| Account | `Account-search-input` |
| Lead | `Lead-search-input` |
| Opportunity | `Opportunity-search-input` |
| Product | `Product-search-input` |
| Price Book | `Price Book-search-input` |
| Case | `Case-search-input` |
| Invoice | `Invoice-search-input` |
| Video Call | `Video Call-search-input` |
| Messaging Session | `Messaging Session-search-input` |
| List Email | `List Email-search-input` |

Behavior:

- Placeholder text: `Search this list...`.
- Results filter within the active list view.
- Empty filtered results should use the same empty-state pattern.

### Toolbar

Common toolbar controls:

- `List View Controls`
- `Select list display`
- `Refresh`
- `Column sort`
- `Edit List`
- `Charts`
- `Filters`

Rules:

- Toolbar controls stay visible even when disabled.
- Disabled controls must show a disabled visual state and should expose a reason when activated or focused.
- Empty lists can disable column sort with the message: `Column sort is disabled. To sort columns, a list view needs at least one row and two columns.`

### List View Controls Menu

Observed menu items:

- `New`
- `Clone`
- `Rename`
- `Sharing Settings`
- `Select Fields to Display`
- `Delete`
- `Reset Column Sorting`
- `Reset Column Widths`

State:

- System/pinned/recent lists frequently disable all except `New`.
- Knowledge omitted `Reset Column Sorting` in the observed menu and kept `Reset Column Widths`.

### Display Selector

Options:

- `Table`
- `Kanban`

Behavior:

- `Table` is the default.
- `Kanban` should be present even if not applicable to all objects.
- If Kanban cannot render a list, show a clear unavailable state.

### Data Grid Behavior

Required grid features:

- Row selection checkbox column.
- Linked record-name columns.
- Column headers with sorting.
- Column header actions menu, exposed as `Show [Column] column actions`.
- Resizable columns.
- Inline edit controls where observed.
- Row action menu exposed as `Show Actions`.
- Bulk actions based on selected rows.

Inline edit examples:

- Contact: `Account Name`, `Phone`, `Email`.
- Account: `Account Name`, `Phone`.
- Messaging Session: inline edit disabled.

### Empty State

Shared empty text:

- `Nothing to see here`
- `There's nothing in your list yet. Try adding a new record.`

Rules:

- Show a direct `New` action when the object supports creation.
- Keep list toolbar and list selector visible.
- Keep disabled sort behavior.
- Empty state should not hide action bar.

## Object Action Bars

Actions must be object-specific:

| Object/page | Actions |
| --- | --- |
| Contacts | `Import`, `Add to Campaign`, `Send Email`, `New`, `Assign Label` |
| Accounts | `New`, `Import`, `Assign Label` |
| Leads | `New`, `Import`, `Add to Campaign`, `Send Email`, `Change Owner`, `Show more actions` |
| Opportunities | `New`, `Import`, `Assign Label` |
| Products | `New`, `Add to Category` |
| Price Books | `New` |
| Cases | `New`, `Change Owner`, `Merge Cases`, `Printable View`, `Assign Label` |
| Quick Text | `New Quick Text`, `New Folder` |
| Knowledge | `New`, `Publish`, `Assign`, `Archive`, `Delete Article`, `Show more actions` |
| List Emails | `Send Email` |
| Commerce | `Create Store` |
| Your Account | `Buy Now` |

More actions:

- Knowledge more-actions menu: `Delete Draft`, `Restore`, `Change Owner`.
- Account record more-actions menu: `Delete`.

## Modal Framework

### Base Modal Layout

Most create/edit flows share:

- Centered modal over dimmed workspace.
- Header: `New [Object]` or `Edit [Record Name]`.
- Top-right `Cancel and close`.
- Required legend: `* = Required Information`.
- Body with sections and field rows.
- Footer actions: `Cancel`, `Save & New`, `Save`.

Exceptions:

- Product create is a wizard with `Cancel` and `Next`.
- List Email starts with layout picker and uses `Preview`, `Select & Continue`, `Cancel and close`.
- Quick Text adds `Preview`.

### Required Field Validation

Behavior:

- Required fields show a visible asterisk in labels.
- If user attempts to save with empty required fields, show inline field-level messages.
- Observed inline text: `Complete this field.`
- Save should remain available, but validation blocks completion.

Observed required fields:

- Account: `Account Name`.
- Contact: `Last Name`, `Account Name`.
- Lead: `Lead Status`, `Last Name`, `Company`.
- Opportunity: `Opportunity Name`, `Account Name`, `Close Date`, `Stage`, `Forecast Category`.
- Case: `Status`.
- Product: `Product Name`.
- Price Book: `Price Book Name`.
- Event: `Subject`, start date/time, end date/time, `Assigned To`.
- Quick Text: `Quick Text Name`, `Message`.
- Knowledge: `Title`, `URL Name`.

### Save Behavior

Required behavior:

- `Save` validates and closes the modal on success.
- `Save & New` validates, creates the record, clears the form, and keeps a new modal open.
- `Cancel` closes without saving.
- `Cancel and close` closes without saving.
- Unsaved changes should trigger a confirmation if fields were edited.
- This analysis never used save actions; implement standard Salesforce-style behavior.

### Lookup Behavior

Lookup fields are searchable comboboxes:

- Placeholder examples:
  - `Search Accounts...`
  - `Search Contacts...`
  - `Search People...`
- Selected lookup values become pills/links.
- Selected value can be cleared with a clear-selection button.
- Polymorphic lookups include an object picker, for example Event `Name` can switch between `Contacts` and `Leads`.

### Picklist Behavior

Picklists are combobox buttons/inputs:

- Values open in a dropdown/listbox.
- `--None--` is included where blank selection is allowed.
- Values should be keyboard navigable.
- Dependent state/province picklists depend on country.
- Time picklists use 15-minute increments across the full day.

## Record Page Framework

### Layout

Record pages include:

- Highlights panel.
- Record object type and name.
- Primary actions.
- Key fields.
- Main tabs: `Related`, `Details`.
- Activity panel.

### Highlights Panel

Contact highlights:

- Heading: `Contact Mr. Rober Antonio`.
- Actions: `View Contact Hierarchy`, `New Opportunity`, `Edit`, `Delete`.
- Key fields: `Account Name`, `Title`, `Phone`, `Email`.

Account highlights:

- Heading: `Account Robert`.
- Actions: `View Account Hierarchy`, `New Contact`, `New Opportunity`, `Edit`, `Show more actions`.
- Key fields: `Phone`, `Website`, `Billing Address`, `Account Owner`.

Behavior:

- Record name is prominent.
- Key fields update after edits.
- Action buttons open modals or menus without losing record context.

### Related Tab

Related lists use cards/list blocks with counts:

- Count in label, for example `Contacts (1)` or `Opportunities (0)`.
- A `New` action where creation is available.
- `View All [Objects]` link when rows exist.
- Row action menus.

Duplicate panel:

- Contact: `We found no potential duplicates of this Contact.`
- Account: `We found no potential duplicates of this Account.`

### Details Tab

Details show sections and inline edit actions:

- Section headers.
- Field label/value pairs.
- Inline edit icons/buttons per editable field.
- Owner field has `Change Owner`.

Clicking inline edit should open an edit modal for that field/record, not navigate away.

## Activity System

### Publisher Tabs

Activity composer actions:

- `Email`
- `More Email Actions`
- `New Event`
- `More New Event Actions`
- `Log a Call`
- `New Task`

Behavior:

- Composer is available on Account and Contact records.
- `New Event` can reuse the Event modal with related record prefilled.
- `Log a Call` should create a completed call activity.
- `New Task` should create a task tied to the record.
- Email composer should allow sending email and timeline logging.

### Activity Timeline

Controls:

- `Only show activities with insights`.
- Filter summary, example: `Within 2 months - All activities - All types`.
- `Timeline Settings`.
- `Refresh`.
- `Expand All`.
- `Upcoming & Overdue`.
- `Show All Activities`.

Empty state:

- `No activities to show. Get started by sending an email, scheduling a task, and more.`

Behavior:

- Timeline should group activities by time.
- Filters update visible activities.
- Empty state remains below controls.

## File And Attachment Upload

Observed on Contact and Account related tabs:

- `Files`.
- `Notes & Attachments`.
- `Add Files`.
- `Upload Files`.
- Drag/drop text: `Drop Files`, `Or drop files`.

Behavior:

- Clicking upload opens a file chooser.
- Dragging files over the drop zone highlights it.
- Upload completion increments count and shows file row.
- Files and Notes/Attachments remain separate related areas.

## Calendar State

Calendar page:

- Object: Event.
- Default observed view: week view.
- Date range observed: July 4, 2026 through July 10, 2026.
- Timezone: `GMT +4`.

Controls:

- `Previous Week`.
- `Next Week`.
- `Today`.
- `Refresh`.
- `View`.
- `New Event`.
- `Show Sidebar`.

Grid:

- Day columns: Saturday through Friday for the observed week.
- `All-Day Events` row.
- Hour rows: 00:00 through 23:00.

Sidebar:

- Mini month picker.
- Previous/next month controls.
- Year picker.
- `My Calendars`.
- `Other Calendars`.
- Calendar option menus.

Behavior:

- Previous/Next changes the visible week.
- Today returns to the current week.
- New Event opens the modal with date context.
- Sidebar can be shown/hidden.

## Home Dashboard State

Home has two observed states:

### Onboarding Home

Content:

- Welcome headline.
- Suggestion cards:
  - `Create your first lead`.
  - `Turn on marketing features`.
  - `Create your first deal`.
- Controls: `Hide suggestions`, `View All Cards`.
- Report selector cards for Leads, Opportunities, Contacts, Cases.
- `View Report`.
- `Recent Records`.
- `Make It Your Home`.

### Dashboard Home

Content:

- `Quarterly Performance`.
- Metrics: `Closed`, `Open (>70%)`, `Goal`.
- Actions: `Refresh Chart`, `Edit Goal`.
- Empty chart copy.
- `Today's Events`, `View Calendar`.
- `Recent Records`.
- `Today's Tasks`.
- `Key Deals - Recent Opportunities`.
- `Assistant`.

Behavior:

- Home should support switching/hiding suggestions.
- Dashboard widgets should tolerate empty data.
- `Make It Your Home` lets user set this page as default.

## In-App Guidance

Observed on Leads:

- Card title: `Focus on the right leads`.
- New Lead guidance card: `Add a lead`.
- Controls: `Snooze In-App Guidance`, `Drag and Drop`, `Dismiss`.

Behavior:

- Guidance appears contextually near the page/form it explains.
- Guidance can be dismissed or snoozed.
- Drag handle allows moving the guidance card.
- It should not block core form submission except visually overlaying part of the page.

## Marketing Activation State

Marketing overview:

- Headline: `Activate powerful marketing tools and boost sales`.
- Primary CTA: `Activate Marketing`.
- Email card: `Send emails with ease`, `Send Email`.
- Section: `Activate Your Growth Engines`.
- Feature headings:
  - `Email Campaigns`.
  - `Custom Landing Pages with Forms`.
  - `Audience Building`.
  - `Pre-Built Analytics`.

Behavior:

- Before activation, show overview and activation CTA.
- `Send Email` routes into List Email flow.
- List Emails remains available in app nav.

## Commerce State

Commerce page:

- Empty state: `You don't have any stores yet!`.
- CTA: `Create Store`.

Behavior:

- Empty state persists until a store exists.
- `Create Store` starts a store creation flow.

## Your Account State

Your Account page:

- Empty/subscription state: `You haven't subscribed yet`.
- CTA: `Buy Now`.

Behavior:

- Links from trial banner and left rail should land here or in the purchase flow.

## Global Search State

Search overlay opens from `Search...`.

Observed suggestions/results:

- `Robert accounts`.
- `accounts with account type customer`.
- `Robert contacts`.
- Contact result format: record name plus `Contact - Account`.
- Account result format: record name plus `Account`.
- Report results such as `Open Cases for Accounts I Own`, `My Closed Cases by Close Date`, `My Cases Closed MTD`.
- List view results such as `All Open Leads`, `All Open Cases`, `All List Emails`.

Behavior:

- Search is global across records, reports, and list views.
- Suggestions appear before typing.
- Results include type context and object icons/labels.
- Selecting a record opens its record page in a console tab.
- Selecting a list view opens the object list with that view.

## Confirmation And Destructive Actions

Destructive actions are visible but should require confirmation:

- Record `Delete`.
- Knowledge `Delete Article`.
- Knowledge more action `Delete Draft`.
- List view `Delete` when enabled.

Rules:

- Never delete immediately from a menu click.
- Confirmation modal should name the target and provide cancel.
- After deletion, return to a sensible list page and show a toast.

## Toasts And Feedback

The inspected read-only pass did not trigger save/delete toasts, but the rebuild should include standard feedback:

- Success toast after create/update/delete.
- Error toast for validation or server errors.
- Warning/confirmation for destructive actions.
- Inline field errors for field-level validation.

## Accessibility Requirements

Observed Salesforce UI exposes many accessible names:

- Buttons have names such as `Cancel and close`, `Close tab`, `Show Actions`.
- Tabs expose `role=tab`.
- Picklists use combobox/listbox semantics.
- Menus use menu/menuitem semantics.

Rebuild should preserve:

- Keyboard navigation for menus and picklists.
- Visible focus states.
- ARIA labels for icon-only actions.
- Screen-reader-friendly object and row labels.
