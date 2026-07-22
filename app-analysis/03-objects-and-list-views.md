# Objects And List Views

## Shared List View Framework

Object list pages share a consistent Lightning list-view pattern:

- Object heading and object icon.
- Current list view name, often `Recently Viewed`, `All Open Leads`, or `All Open Cases`.
- `Select a List View: [Object]` dropdown.
- Pin control:
  - `Pin this list view.`
  - `This list is pinned.`
- Object action bar.
- Record count/status line:
  - Format examples: `1 item - Updated a few seconds ago`, `0 items - Sorted by Name - Filtered by Lead Status - Updated a few seconds ago`.
- Local search input:
  - Placeholder: `Search this list...`
  - Input name uses object-specific prefixes such as `Contact-search-input`, `Lead-search-input`.
- Utility buttons:
  - `List View Controls`
  - `Select list display`
  - `Refresh`
  - `Column sort`
  - `Edit List`
  - `Charts`
  - `Filters`
- Data grid with selectable rows, sortable column headers, resizable column widths, inline edit affordances where available, and row action menus.
- Empty state:
  - `Nothing to see here`
  - `There's nothing in your list yet. Try adding a new record.`

## List View Selector

Contact list view selector options observed:

- `All Contacts`
- `Birthdays This Month`
- `My Contacts`
- `New This Week`
- `Recently Viewed (Pinned list)`
- `Recently Viewed Contacts`
- Search box inside selector: `Search lists...`
- Group labels: `Recent List Views`, `All Other Lists`

Rebuild requirement: every object list view selector should support grouped list views, typeahead search, and pinned-list indication.

## List View Controls Menu

Contact `List View Controls` menu items observed:

| Item | State in pinned Recently Viewed list |
| --- | --- |
| New | Enabled |
| Clone | Disabled |
| Rename | Disabled |
| Sharing Settings | Disabled |
| Select Fields to Display | Disabled |
| Delete | Disabled |
| Reset Column Sorting | Disabled |
| Reset Column Widths | Disabled |

Rebuild requirement: menu items can be visible but disabled depending on list ownership/system status.

## Display Selector

`Select list display` menu options observed:

- `Table`
- `Kanban`

Rebuild requirement: expose both options. If an object/list cannot support Kanban, show the option disabled or block selection with a clear state.

## Object Index

### Contacts

- Object API-style name: `Contact`
- URL: `/lightning/o/Contact/list`
- Default list: `Recently Viewed`
- Data state: one row observed.
- Actions:
  - `Import`
  - `Add to Campaign`
  - `Send Email`
  - `New`
  - `Assign Label`
- List search: `Contact-search-input`
- Columns:
  - selectable row checkbox
  - `Name`
  - `Account Name`
  - `Phone`
  - `Email`
  - `Contact Owner Alias`
  - `Action`
- Inline edit affordances:
  - `Edit Account Name`
  - `Edit Phone`
  - `Edit Email`
- Column actions:
  - `Show Name column actions`
  - `Show Account Name column actions`
  - `Show Phone column actions`
  - `Show Email column actions`
  - `Show Contact Owner Alias column actions`
- Row action: `Show Actions`

### Accounts

- Object API-style name: `Account`
- URL: `/lightning/o/Account/list`
- Default list: `Recently Viewed`
- Data state: one row observed.
- Actions:
  - `New`
  - `Import`
  - `Assign Label`
- List search: `Account-search-input`
- Columns:
  - selectable row checkbox
  - `Account Name`
  - `Phone`
  - `Account Owner Alias`
  - `Action`
- Inline edit affordances:
  - `Edit Account Name`
  - `Edit Phone`
- Row action: `Show Actions`

### Leads

- Object API-style name: `Lead`
- URL: `/lightning/o/Lead/list`
- Sales default list: `All Open Leads`
- Direct object default list: `Recently Viewed`
- Data state: empty.
- Actions:
  - `New`
  - `Import`
  - `Add to Campaign`
  - `Send Email`
  - `Change Owner`
  - `Show more actions`
- List search: `Lead-search-input`
- `All Open Leads` columns when in Sales app:
  - selectable row checkbox
  - `Name`
  - `Company`
  - `State/Province (text only)`
  - `Phone`
  - `Email`
  - `Lead Status`
  - `Created Date`
  - `Owner Alias`
  - `Action`
- Empty direct list behavior:
  - column sort disabled with message: `Column sort is disabled. To sort columns, a list view needs at least one row and two columns.`
- In-app guidance appears on the empty Leads list.

### Opportunities

- Object API-style name: `Opportunity`
- URL: `/lightning/o/Opportunity/list`
- Default list: `Recently Viewed`
- Data state: empty.
- Actions:
  - `New`
  - `Import`
  - `Assign Label`
- List search: `Opportunity-search-input`
- Empty state and disabled column sort are shown when no rows exist.

### Products

- Object API-style name: `Product2`
- URL: `/lightning/o/Product2/home`
- Default list: `Recently Viewed`
- Data state: empty.
- Actions:
  - `New`
  - `Add to Category`
- List search: `Product-search-input`
- Empty state and disabled column sort are shown when no rows exist.

### Price Books

- Object API-style name: `Pricebook2`
- URL: `/lightning/o/Pricebook2/home`
- Default list: `Recently Viewed`
- Data state: empty.
- Actions:
  - `New`
- List search: `Price Book-search-input`
- Empty state and disabled column sort are shown when no rows exist.

### Calendar / Events

- Object API-style name: `Event`
- URL: `/lightning/o/Event/home`
- Observed mode: week view.
- Current visible range: `July 4, 2026-July 10, 2026`.
- Timezone: `GMT +4`.
- Actions:
  - `Previous Week`
  - `Next Week`
  - `Today`
  - `Refresh`
  - `View`
  - `New Event`
  - `Show Sidebar`
- Week columns:
  - `SAT 4`
  - `SUN 5`
  - `MON 6`
  - `TUE 7`
  - `WED 8`
  - `THU 9`
  - `FRI 10`
- Calendar grid:
  - `All-Day Events`
  - Hour rows from `00:00` through `23:00`
- Sidebar:
  - Mini month picker with previous/next month controls.
  - Year picker.
  - `My Calendars`, `Other Calendars`.
  - Calendar options menus.

### Analytics

- URL: `/lightning/page/analytics`
- In the inspected workspace this page mostly exposed the console tab entry and nav shell.
- Must be implemented as a destination that can host reports/dashboards.

### Invoices

> Implementation note (July 22, 2026): the observations below describe the original empty Salesforce trial surface. The CRM now implements complete organization-scoped Sales invoicing, documented in `11-sales-invoicing-implementation.md`; this historical observation is intentionally retained.

- Object API-style name: `Invoice`
- URL: `/lightning/o/Invoice/home`
- Default list: `Recently Viewed`
- Data state: empty.
- Actions:
  - `List View Controls`
  - `Refresh`
  - `Edit List`
  - `Charts`
  - `Filters`
- List search: `Invoice-search-input`
- No `New` button was visible in the inspected list.

### Video Calls

- Object API-style name: `VideoCall`
- URL: `/lightning/o/VideoCall/home`
- Default list: `Recently Viewed`
- Data state: empty.
- Actions:
  - `List View Controls`
  - `Refresh`
  - `Edit List`
  - `Charts`
  - `Filters`
- List search: `Video Call-search-input`
- No `New` button was visible in the inspected list.

### Cases

- Object API-style name: `Case`
- Service default list: `All Open Cases`
- URL: `/lightning/o/Case/home`
- Data state: empty.
- Actions:
  - `New`
  - `Change Owner`
  - `Merge Cases`
  - `Printable View` in all-open view
  - `Assign Label`
- List search: `Case-search-input`
- `All Open Cases` columns:
  - selectable row checkbox
  - `Case Number`
  - `Contact Name`
  - `Subject`
  - `Status`
  - `Priority`
  - `Date/Time Opened`
  - `Case Owner Alias`
  - `Action`
- Empty direct list behavior:
  - disabled column sort when no rows exist.

### Quick Text

- Object API-style name: `QuickText`
- URL: `/lightning/o/QuickText/home`
- Page type: library/folder list rather than standard table grid.
- Data state: empty.
- Actions:
  - `New Quick Text`
  - `New Folder`
  - `Personalize your list view settings.`
- Search placeholder: `Search recent quick text...`
- Left/categories:
  - `QUICK TEXT`
    - `Recent`
    - `All Quick Text`
  - `FOLDERS`
    - `All Folders`
    - `Created by Me`
    - `Shared with Me`
  - `FAVORITES`
    - `All Favorites`

### Messaging Sessions

- Object API-style name: `MessagingSession`
- URL: `/lightning/o/MessagingSession/home`
- Default list: `Recently Viewed`
- Data state: empty.
- Actions:
  - `List View Controls`
  - `Refresh`
  - `Charts`
  - `Filters`
- List search: `Messaging Session-search-input`
- Inline edit disabled message:
  - `Inline edit isn't available for the displayed fields.`

### Knowledge

- Object API-style name: `Knowledge__kav`
- URL: `/lightning/o/Knowledge__kav/list?filterName=__Recent`
- Default list: `Recently Viewed`
- Data state: no recently viewed articles.
- Actions:
  - `New`
  - `Publish`
  - `Assign`
  - `Archive`
  - `Delete Article`
  - `Show more actions`
- Columns:
  - `Article Title`
  - `Summary`
  - `Article Number`
  - `Published Date`
  - `Publication Status`
  - `Validation Status`
  - `Action`
- Empty state:
  - `You haven't viewed any Knowledge recently.`
  - `Try switching list views.`
- Column sort can be unavailable for this object.

### List Emails

- Object API-style name: `ListEmail`
- URL: `/lightning/o/ListEmail/home`
- Default list: `Recently Viewed`
- Data state: empty.
- Primary action:
  - `Send Email`
- List search: `List Email-search-input`
- Empty state and disabled column sort are shown when no rows exist.
