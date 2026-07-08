# Field Dictionary And Picklists

This file is the object-by-object form and field inventory needed to rebuild the app. It combines visible create dialogs, edit dialogs, record detail pages, list columns, and safely opened picklists.

Notation:

- `Required`: a visible required asterisk or required validation state was observed.
- `Default`: the value shown before user input.
- `Lookup`: searchable relationship selector.
- `Picklist`: dropdown/combobox. Values listed here are observed values; for country and time lists, the UI exposes a long standard list and the rebuild should implement the full standard set.
- `Owner`: current logged-in user, observed as `Parsa Gholipourjamnani`; list-owner alias observed as `PGhol`.

## Shared Field Patterns

### Owners

Owner fields appear on records and create/edit dialogs:

| Field | Objects | Behavior |
| --- | --- | --- |
| `Account Owner` | Account | Defaults to current user. Record details show owner link with `Preview` and `Change Owner`. |
| `Contact Owner` | Contact | Defaults to current user. Record details show owner link with `Change Owner`. |
| `Lead Owner` | Lead | Defaults to current user. |
| `Opportunity Owner` | Opportunity | Defaults to current user. |
| `Case Owner` | Case | Defaults to current user. |
| `Assigned To` | Event | Required lookup, defaults to current user. |

### Audit Fields

Record edit forms and detail pages expose read-only audit fields:

| Field | Objects observed | Behavior |
| --- | --- | --- |
| `Created By` | Account, Contact, Knowledge | Display-only user/date pair. |
| `Last Modified By` | Account, Contact, Knowledge | Display-only user/date pair. |
| `Article Created Date` | Knowledge | Display-only date/time. |
| `Article Archived Date` | Knowledge | Display-only date/time. |
| `Archived By` | Knowledge | Display-only lookup/user field. |

### Address Fields

Address groups are rendered as multiple inputs:

| Address group | Fields |
| --- | --- |
| Lead `Address` | `Country`, `Street`, `Zip/Postal Code`, `City`, `State/Province` |
| Contact `Mailing Address` | `Mailing Country`, `Mailing Street`, `Mailing Zip/Postal Code`, `Mailing City`, `Mailing State/Province` |
| Account `Billing Address` | `Billing Country`, `Billing Street`, `Billing Zip/Postal Code`, `Billing City`, `Billing State/Province` |
| Account `Shipping Address` | `Shipping Country`, `Shipping Street`, `Shipping Zip/Postal Code`, `Shipping City`, `Shipping State/Province` |

Country dropdown behavior:

- Default: `--None--`.
- Observed values include `Afghanistan`, `Aland Islands`, `Albania`, `Algeria`, `Andorra`, `Angola`, `Anguilla`, `Antarctica`, `Antigua and Barbuda`, `Argentina`, `Armenia`, `Aruba`, `Australia`, `Austria`, `Azerbaijan`, `Bahamas`, `Bahrain`, `Bangladesh`, and `Barbados`.
- The dropdown continues beyond the sampled values and should be implemented as a full standard country list.
- State/province is dependent on country. With no country selected it is empty or only `--None--`.

## Account

Object identity:

- Label: `Account`
- API-style object name: `Account`
- List URL pattern: `/lightning/o/Account/list`
- Record URL pattern: `/lightning/r/Account/{id}/view`
- New URL pattern: `/lightning/o/Account/new`
- Edit URL pattern: `/lightning/r/Account/{id}/edit`

### Account Create/Edit Form

| Section | Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- | --- |
| About | `Account Name` | Text | Yes | Existing record: `Robert` | Main display name and record heading. |
| About | `Website` | URL/text | No | Blank | Inline editable on record details. |
| About | `Type` | Picklist | No | New: `--None--`; existing: `Customer` | Controls account classification. |
| About | `Description` | Long text | No | Blank | Inline editable. |
| About | `Parent Account` | Lookup Account | No | Blank | Search placeholder `Search Accounts...`. |
| About | `Account Owner` | Owner lookup | No | Current user | Change owner action on record. |
| Get in Touch | `Phone` | Phone/text | No | Blank | Inline editable and list column. |
| Billing Address | `Billing Country` | Country picklist | No | `--None--` | Dependent address field. |
| Billing Address | `Billing Street` | Textarea | No | Blank | Multi-line address input. |
| Billing Address | `Billing Zip/Postal Code` | Text | No | Blank | Postal code. |
| Billing Address | `Billing City` | Text | No | Blank | City. |
| Billing Address | `Billing State/Province` | Dependent picklist | No | `--None--` | Depends on billing country. |
| Shipping Address | `Shipping Country` | Country picklist | No | `--None--` | Same country list behavior. |
| Shipping Address | `Shipping Street` | Textarea | No | Blank | Multi-line address input. |
| Shipping Address | `Shipping Zip/Postal Code` | Text | No | Blank | Postal code. |
| Shipping Address | `Shipping City` | Text | No | Blank | City. |
| Shipping Address | `Shipping State/Province` | Dependent picklist | No | `--None--` | Depends on shipping country. |
| History | `Created By` | Read-only audit | No | Current user/date | Visible on edit and details. |
| History | `Last Modified By` | Read-only audit | No | Current user/date | Visible on edit and details. |

### Account Type Picklist

Observed values:

- `--None--`
- `Analyst`
- `Competitor`
- `Customer`
- `Integrator`
- `Investor`
- `Partner`
- `Press`
- `Prospect`
- `Reseller`
- `Other`

### Account List Columns

| Column | Behavior |
| --- | --- |
| Selection checkbox | Enables bulk actions. |
| `Account Name` | Link to record; inline edit available. |
| `Phone` | Inline edit available. |
| `Account Owner Alias` | Owner alias, observed `PGhol`. |
| `Action` | Row action menu. |

### Account Related Lists

On the observed account record:

- `Contacts (1)` with `New`, row action, and `View All Contacts`.
- `Opportunities (0)` with `New`.
- `Cases (0)` with `New`.
- `Partners (0)` with `New`.
- `Files` with upload/drop behavior.
- `Notes & Attachments`.

## Contact

Object identity:

- Label: `Contact`
- API-style object name: `Contact`
- List URL pattern: `/lightning/o/Contact/list`
- Record URL pattern: `/lightning/r/Contact/{id}/view`
- New URL pattern: `/lightning/o/Contact/new`
- Edit URL pattern: `/lightning/r/Contact/{id}/edit`

### Contact Create/Edit Form

| Section | Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- | --- |
| About | `Salutation` | Picklist | No | New: `--None--`; existing: `Mr.` | Part of compound name. |
| About | `First Name` | Text | No | Existing: `Rober` | Part of compound name. |
| About | `Last Name` | Text | Yes | Existing: `Antonio` | Main required name part. |
| About | `Account Name` | Lookup Account | Yes | Existing: `Robert` | Search placeholder `Search Accounts...`; clear selection button. |
| About | `Title` | Text | No | Blank | Highlights panel key field. |
| About | `Reports To` | Lookup Contact | No | Blank | Search placeholder `Search Contacts...`. |
| About | `Description` | Long text | No | Blank | Inline editable. |
| About | `Contact Owner` | Owner lookup | No | Current user | Change owner available. |
| Get in Touch | `Phone` | Phone/text | No | Blank | List column and highlights key field. |
| Get in Touch | `Email` | Email/text | No | Blank | List column and highlights key field. |
| Mailing Address | `Mailing Country` | Country picklist | No | `--None--` | Full country list behavior. |
| Mailing Address | `Mailing Street` | Textarea | No | Blank | Multi-line address input. |
| Mailing Address | `Mailing Zip/Postal Code` | Text | No | Blank | Postal code. |
| Mailing Address | `Mailing City` | Text | No | Blank | City. |
| Mailing Address | `Mailing State/Province` | Dependent picklist | No | `--None--` | Depends on mailing country. |
| History | `Created By` | Read-only audit | No | Current user/date | Visible on edit and details. |
| History | `Last Modified By` | Read-only audit | No | Current user/date | Visible on edit and details. |

### Salutation Picklist

Observed values:

- `--None--`
- `Mr.`
- `Ms.`
- `Mrs.`
- `Dr.`
- `Prof.`
- `Mx.`

### Contact List Columns

| Column | Behavior |
| --- | --- |
| Selection checkbox | Enables bulk actions. |
| `Name` | Link to record. |
| `Account Name` | Link/lookup column; inline edit available. |
| `Phone` | Inline edit available. |
| `Email` | Inline edit available. |
| `Contact Owner Alias` | Owner alias, observed `PGhol`. |
| `Action` | Row action menu. |

### Contact Related Lists

On the observed contact record:

- Duplicate panel: no potential duplicates.
- `Opportunities (0)` with `New`.
- `Cases (0)` with `New`.
- `Files (0)` with `Add Files`, `Upload Files`, and drag/drop.
- `Notes & Attachments (0)` with upload/drop.

## Lead

Object identity:

- Label: `Lead`
- API-style object name: `Lead`
- List URL pattern: `/lightning/o/Lead/list`
- New URL pattern: `/lightning/o/Lead/new`
- Sales default list: `All Open Leads`

### Lead Create Form

| Section | Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- | --- |
| About | `Lead Status` | Picklist | Yes | `New` | Required stage/status. |
| About | `Salutation` | Picklist | No | `--None--` | Compound name field. |
| About | `First Name` | Text | No | Blank | Compound name field. |
| About | `Last Name` | Text | Yes | Blank | Required. |
| About | `Company` | Text | Yes | Blank | Required. |
| About | `Title` | Text | No | Blank | Job title. |
| About | `Website` | URL/text | No | Blank | Website. |
| About | `Description` | Long text | No | Blank | Long notes. |
| About | `Lead Owner` | Owner lookup | No | Current user | Defaults to owner. |
| About | `Rating` | Picklist | No | `--None--` | Lead quality. |
| Get in Touch | `Phone` | Phone/text | No | Blank | List column. |
| Get in Touch | `Email` | Email/text | No | Blank | List column. |
| Address | `Country` | Country picklist | No | `--None--` | Full country list behavior. |
| Address | `Street` | Textarea | No | Blank | Street. |
| Address | `Zip/Postal Code` | Text | No | Blank | Postal code. |
| Address | `City` | Text | No | Blank | City. |
| Address | `State/Province` | Dependent picklist | No | `--None--` | Depends on country. |
| Segment | `No. of Employees` | Number | No | Blank | Segment metric. |
| Segment | `Annual Revenue` | Currency/number | No | Blank | Segment metric. |
| Segment | `Lead Source` | Picklist | No | `--None--` | Acquisition source. |
| Segment | `Industry` | Picklist | No | `--None--` | Business category. |

### Lead Picklists

`Lead Status`:

- `--None--`
- `New`
- `Contacted`
- `Nurturing`
- `Qualified`
- `Unqualified`

`Rating`:

- `--None--`
- `Hot`
- `Warm`
- `Cold`

`Lead Source`:

- `--None--`
- `Advertisement`
- `Employee Referral`
- `External Referral`
- `Partner`
- `Public Relations`
- `Seminar - Internal`
- `Seminar - Partner`
- `Trade Show`
- `Web`
- `Word of mouth`
- `Other`

`Industry`:

- `--None--`
- `Agriculture`
- `Apparel`
- `Banking`
- `Biotechnology`
- `Chemicals`
- `Communications`
- `Construction`
- `Consulting`
- `Education`
- `Electronics`
- `Energy`
- `Engineering`
- `Entertainment`
- `Environmental`
- `Finance`
- `Food & Beverage`
- `Government`
- `Healthcare`
- `Hospitality`
- `Insurance`
- `Machinery`
- `Manufacturing`
- `Media`
- `Not For Profit`
- `Other`
- `Recreation`
- `Retail`
- `Shipping`
- `Technology`
- `Telecommunications`
- `Transportation`
- `Utilities`

### Lead List Columns

`All Open Leads` list columns:

- `Name`
- `Company`
- `State/Province (text only)`
- `Phone`
- `Email`
- `Lead Status`
- `Created Date`
- `Owner Alias`
- `Action`

## Opportunity

Object identity:

- Label: `Opportunity`
- API-style object name: `Opportunity`
- List URL pattern: `/lightning/o/Opportunity/list`
- New URL pattern: `/lightning/o/Opportunity/new`

### Opportunity Create Form

| Section | Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- | --- |
| About | `Opportunity Name` | Text | Yes | Blank | Empty required field shows `Complete this field.` |
| About | `Account Name` | Lookup Account | Yes | Blank | Search placeholder `Search Accounts...`. |
| About | `Close Date` | Date | Yes | Blank | Date picker; localized date format hint. |
| About | `Amount` | Currency/number | No | Blank | Numeric amount. |
| About | `Description` | Long text | No | Blank | Notes. |
| About | `Opportunity Owner` | Owner lookup | No | Current user | Defaults to current user. |
| Status | `Stage` | Picklist | Yes | `--None--` | Required. |
| Status | `Probability (%)` | Number | No | Blank | Numeric percentage. |
| Status | `Forecast Category` | Picklist | Yes | `--None--` | Required; value list did not expand in UI probe. |
| Status | `Next Step` | Text | No | Blank | Next action. |

### Opportunity Stage Picklist

Observed values:

- `--None--`
- `Qualify`
- `Meet & Present`
- `Propose`
- `Negotiate`
- `Closed Won`
- `Closed Lost`

### Opportunity List

- Default list: `Recently Viewed`.
- Data state observed: empty.
- Actions: `New`, `Import`, `Assign Label`.
- Search input: `Opportunity-search-input`.
- Empty state uses shared `Nothing to see here` pattern.

## Case

Object identity:

- Label: `Case`
- API-style object name: `Case`
- List URL pattern: `/lightning/o/Case/list`
- New URL pattern: `/lightning/o/Case/new`
- Service default list: `All Open Cases`

### Case Create Form

| Section | Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- | --- |
| Case Information | `Status` | Picklist | Yes | `New` | Required. |
| Case Information | `Case Origin` | Picklist | No | `--None--` | Intake source. |
| Case Information | `Priority` | Picklist | No | `Medium` | Priority. |
| Case Information | `Case Owner` | Owner lookup | No | Current user | Defaults to current user. |
| Contact Information | `Contact Name` | Lookup Contact | No | Blank | Search placeholder `Search Contacts...`. |
| Contact Information | `Account Name` | Lookup Account | No | Blank | Search placeholder `Search Accounts...`. |
| Description Information | `Subject` | Text | No | Blank | Case subject. |
| Description Information | `Description` | Long text | No | Blank | Case details. |
| Description Information | `Send notification email to contact` | Checkbox | No | Unchecked | Sends contact notification if enabled. |

### Case Picklists

`Status`:

- `--None--`
- `New`
- `Working`
- `Waiting on Customer`
- `Escalated`
- `Closed`

`Case Origin`:

- `--None--`
- `Email`
- `Phone`
- `Web`

`Priority`:

- `--None--`
- `High`
- `Medium`
- `Low`

### Case List Columns

`All Open Cases` columns:

- `Case Number`
- `Contact Name`
- `Subject`
- `Status`
- `Priority`
- `Date/Time Opened`
- `Case Owner Alias`
- `Action`

Actions on Cases list:

- `New`
- `Change Owner`
- `Merge Cases`
- `Printable View`
- `Assign Label`

## Product

Object identity:

- Label: `Product`
- API-style object name: `Product2`
- List URL pattern: `/lightning/o/Product2/home`
- New URL pattern: `/lightning/o/Product2/new`

### Product Wizard

The product create workflow is a staged wizard:

- Stage 1: `New Product - Current Stage`.
- Stage 2: `New Price Book Entry - Stage Not Started`.
- Progress: `0%`.
- Footer actions: `Cancel`, `Next`.

Fields:

| Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- |
| `Product Name` | Text | Yes | Blank | Required primary name. |
| `Product Family` | Picklist | No | `--None--` | Values observed: `--None--`, `None`. |
| `Product Code` | Text | No | Blank | Product code. |
| `Product SKU` | Text | No | Blank | SKU. |
| `Active` | Checkbox | No | Unchecked/blank | Active product toggle. |
| `Product Description` | Long text | No | Blank | Description. |

List actions:

- `New`
- `Add to Category`

## Price Book

Object identity:

- Label: `Price Book`
- API-style object name: `Pricebook2`
- List URL pattern: `/lightning/o/Pricebook2/home`
- New URL pattern: `/lightning/o/Pricebook2/new`

### Price Book Create Form

| Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- |
| `Price Book Name` | Text | Yes | Blank | Required primary name. |
| `Active` | Checkbox | No | Unchecked/blank | Active toggle. |
| `Description` | Long text | No | Blank | Description. |
| `Is Standard Price Book` | Read-only boolean | No | `False` | Display-only. |
| `Valid From` | Date/time | No | Blank | Date picker plus time combobox. |
| `Valid To` | Date/time | No | Blank | Date picker plus time combobox. |

Time dropdown behavior:

- `Valid From` and `Valid To` time selectors show 96 values at 15-minute increments across a day.
- Values are localized in the observed org/browser.

## Event

Object identity:

- Label: `Event`
- API-style object name: `Event`
- Calendar URL pattern: `/lightning/o/Event/home`
- New URL pattern: `/lightning/o/Event/new`

### Event Create Form

| Section | Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- | --- |
| Information | `Subject` | Combobox/text | Yes | Blank | Empty required field shows `Complete this field.` |
| Information | `Description` | Long text | No | Blank | Tip: Control + period inserts quick text. |
| Start | `Date` | Date | Yes | Current selected date | Date picker; localized date hint. |
| Start | `Time` | Time picklist | Yes | Current slot | 15-minute increments. |
| End | `Date` | Date | Yes | Current selected date | Defaults same date. |
| End | `Time` | Time picklist | Yes | One hour after start | 15-minute increments. |
| Attendees | `People` | Lookup/multi-selector | No | Current user visible | Search placeholder `Search People...`. |
| Related Records | `Name` | Polymorphic lookup | No | Object default `Contacts` | Object selector options: `Contacts`, `Leads`. |
| Related Records | `Related To` | Polymorphic lookup | No | Object default `Accounts` | See related object options below. |
| Related Records | `Assigned To` | Owner lookup | Yes | Current user | Required. |
| Additional Information | `Location` | Text | No | Blank | Location. |
| Additional Information | `Show Time As` | Picklist | No | `Busy` | Availability. |
| Additional Information | `All-Day Event` | Checkbox | No | Unchecked | Converts to all-day display. |
| Additional Information | `Private` | Checkbox | No | Unchecked | Shows privacy notice. |

Subject options:

- `Call`
- `Email`
- `Meeting`
- `Send Letter/Quote`
- `Other`

Observed `Related To` object selector options:

- `Accounts`
- `Activity History`
- `Asset Relationships`
- `Assets`
- `Buyer Accounts`
- `Buyer Group Price Books`
- `Campaigns`
- `Cases`
- `Catalogs`
- `Communication Subscription Consents`
- `Contact Requests`
- `Coupons`
- `Credit Memos`
- `Environments`
- `Fulfillment Orders`
- `Goal Assignments`
- `Goal Definitions`
- `Images`
- `Invoice Documents`
- `Invoices`
- `Legal Entities`
- `List Emails`
- `Locations`
- `Opportunities`
- `Order Summaries`
- `Orders`
- `Party Consents`
- `Price Adjustment Schedules`
- `Price Adjustment Tiers`
- `Products`
- `Promotion Market Segments`
- `Promotion Qualifiers`
- `Promotion Segment Buyer Groups`
- `Promotion Segment Sales Stores`
- `Promotion Segments`
- `Promotion Targets`
- `Promotion Tiers`
- `Promotions`
- `Query Editor`
- `Request Infos`
- `Shipment Items`
- `Shipments`
- `Shipping Carrier Methods`
- `Shipping Carriers`
- `Store Price Books`
- `Web Store Message Contents`

## Quick Text

Object identity:

- Label: `Quick Text`
- API-style object name: `QuickText`
- List URL pattern: `/lightning/o/QuickText/home`
- New URL pattern: `/lightning/o/QuickText/new`

### Quick Text Create Form

| Field/Area | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- |
| `Quick Text Name` | Text | Yes | Blank | Required name. |
| `Message` | Text/rich message | Yes | Blank | Required snippet body. |
| `Insert Merge Field` | Helper action | No | Closed/open helper | Inserts merge tokens. |
| `Related To` | Merge-field object selector | No | `Choose...` | Part of merge helper. |
| `Field` | Merge-field field selector | No | `Choose...` | Part of merge helper. |
| `Folder` | Folder selector | No | `Select Folder` | Stores snippet in folder. |
| `Category` | Picklist/text | No | `Greetings` | Category value observed. |
| `Channel` | Dual-list selector | Yes/No by app rules | Selected: `Email` | Controls where snippet is available. |
| `Include in selected channels` | Toggle/checkbox | No | Blank | Applies selected channels. |

Channel dual-list values:

- Available: `Event`, `Task`, `CaseComment`, `Knowledge`.
- Selected: `Email`.

Footer actions:

- `Preview`
- `Cancel`
- `Save & New`
- `Save`

## Knowledge Article

Object identity:

- Label: `Knowledge`
- API-style object name: `Knowledge__kav`
- List URL pattern: `/lightning/o/Knowledge__kav/list`
- New URL pattern: `/lightning/o/Knowledge__kav/new`

### Knowledge Create Form

| Section | Field | Type | Required | Default/Observed | Notes |
| --- | --- | --- | --- | --- | --- |
| Information | `Title` | Text | Yes | Blank | Required. |
| Information | `URL Name` | Text/slug | Yes | Blank | Required slug. |
| Information | `Article Body` | Rich text | No | Blank | TinyMCE-style editor. |
| Visibility | `Visible In Internal App` | Checkbox | No | Checked | Internal visibility. |
| Visibility | `Visible to Customer` | Checkbox | No | Unchecked/blank | Customer visibility. |
| Details | `Article Created Date` | Read-only date | No | Blank for new | Audit field. |
| Details | `Created By` | Read-only user | No | Blank/current | Audit field. |
| Details | `Article Archived Date` | Read-only date | No | Blank | Archive field. |
| Details | `Last Modified By` | Read-only user | No | Blank/current | Audit field. |
| Details | `Article Total View Count` | Read-only number | No | Blank/0 | Analytics field. |
| Details | `Archived By` | Read-only user | No | Blank | Archive field. |

Rich editor capabilities:

- Menus: `File`, `Edit`, `Insert`, `View`, `Format`, `Table`, `Tools`, `Help`.
- Toolbar: `Fullscreen`, `Redo`, `Undo`, paragraph selector, `Bold`, `Italic`, `Underline`, `Strikethrough`, text color, background color, clear formatting, align left/center/right, justify, reveal/hide more toolbar items.
- Word count starts at `0 words`.

List columns:

- `Article Title`
- `Summary`
- `Article Number`
- `Published Date`
- `Publication Status`
- `Validation Status`
- `Action`

List actions:

- `New`
- `Publish`
- `Assign`
- `Archive`
- `Delete Article`
- `Show more actions`
- More actions menu: `Delete Draft`, `Restore`, `Change Owner`.

List view selector values:

- `All Articles`
- `Archived Articles`
- `Draft Articles`
- `Published Articles`
- `Recently Viewed (Pinned list)`

## List Email

Object identity:

- Label: `List Email`
- API-style object name: `ListEmail`
- List URL pattern: `/lightning/o/ListEmail/home`

List behavior:

- Action: `Send Email`.
- Search input: `List Email-search-input`.
- List view selector values: `All List Emails`, `My List Emails`, `Recently Viewed (Pinned list)`.

Send Email wizard step 1:

| Layout | Purpose observed |
| --- | --- |
| `Sales` | Targeted outreach to sales leads. |
| `Announcement` | Important updates or big events. |
| `Newsletter` | Regular updates or brand promotion. |
| `Rich Text` | Simple text-only layout for quick clear messages. |
| `Create with HTML` | Custom HTML email. |
| `Plain Text` | Compose plain text email from scratch. |

Controls:

- Tabs: `Layout Options`, `Saved Emails`.
- Search placeholder: `Search...`.
- One radio input per layout.
- Footer/actions: `Preview`, `Select & Continue`, `Cancel and close`.

## Messaging Session

Object identity:

- Label: `Messaging Session`
- API-style object name: `MessagingSession`
- List URL pattern: `/lightning/o/MessagingSession/home`

Observed list behavior:

- Search input: `Messaging Session-search-input`.
- Actions: `List View Controls`, `Refresh`, `Charts`, `Filters`.
- Inline edit is disabled and the UI shows an inline-edit disabled message.
- Data state observed: empty/recently viewed style page.

## Invoice

Object identity:

- Label: `Invoice`
- API-style object name: `Invoice`
- List URL pattern: `/lightning/o/Invoice/home`

Observed list behavior:

- Search input: `Invoice-search-input`.
- Actions: `List View Controls`, `Refresh`, `Edit List`, `Charts`, `Filters`.
- No visible `New` action in inspected state.
- Data state observed: empty.

## Video Call

Object identity:

- Label: `Video Call`
- API-style object name: `VideoCall`
- List URL pattern: `/lightning/o/VideoCall/home`

Observed list behavior:

- Search input: `Video Call-search-input`.
- Actions: `List View Controls`, `Refresh`, `Edit List`, `Charts`, `Filters`.
- No visible `New` action in inspected state.
- Data state observed: empty.
