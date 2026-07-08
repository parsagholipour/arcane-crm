# Forms And Workflows

## Shared Create Dialog Behavior

Most create flows open in a Lightning modal overlay:

- Header: `New [Object]`
- Top-right button: `Cancel and close`
- Required field legend: `* = Required Information`
- Footer buttons:
  - `Cancel`
  - `Save & New`
  - `Save`
- Lookup fields use combobox/search inputs.
- Picklists use combobox buttons.
- Date fields include a date picker button.
- Save actions were not used during analysis.

## New Lead

Trigger: Sales app -> Leads -> `New`.

The Lead dialog can appear with an in-app guidance card titled `Add a lead`. The card does not replace the form; it overlays beside it.

Guidance card:

- Title: `Add a lead`
- Copy: first enter and save a few details about the lead.
- Example suggestion: add a sample lead.
- Controls:
  - `Snooze In-App Guidance`
  - `Drag and Drop`
  - `Dismiss`

Fields and sections:

- Section: `About`
- `Lead Status` - required picklist, default `New`
- Compound section: `Name`
  - `Salutation` - picklist, default `--None--`
  - `First Name`
  - `Last Name` - required
- `Company` - required
- `Title`
- `Website`
- `Description`
- `Lead Owner` - current user
- `Rating` - picklist, default `--None--`
- Section: `Get in Touch`
  - `Phone`
  - `Email`
- Section: `Address`
  - `Country`
  - `Street`
  - `Zip/Postal Code`
  - `City`
  - `State/Province`
- Section: `Segment`
  - `No. of Employees`
  - `Annual Revenue`
  - `Lead Source` - picklist, default `--None--`
  - `Industry` - picklist, default `--None--`

## New Contact

Trigger: Contacts list -> `New`.

Fields and sections:

- Section: `About`
- Compound section: `Name`
  - `Salutation` - picklist, default `--None--`
  - `First Name`
  - `Last Name` - required
- `Account Name` - required lookup
- `Title`
- `Reports To` - lookup
- `Description`
- `Contact Owner` - current user
- Section: `Get in Touch`
  - `Phone`
  - `Email`
- Section: `Mailing Address`
  - `Mailing Country`
  - `Mailing Street`
  - `Mailing Zip/Postal Code`
  - `Mailing City`
  - `Mailing State/Province`

## New Account

Trigger: Accounts list -> `New`.

Fields and sections:

- Section: `About`
- `Account Name` - required
- `Website`
- `Type` - picklist, default `--None--`
- `Description`
- `Parent Account` - lookup
- `Account Owner` - current user
- Section: `Get in Touch`
  - `Phone`
- Section: `Billing Address`
  - `Billing Country`
  - `Billing Street`
  - `Billing Zip/Postal Code`
  - `Billing City`
  - `Billing State/Province`
- Section: `Shipping Address`
  - `Shipping Country`
  - `Shipping Street`
  - `Shipping Zip/Postal Code`
  - `Shipping City`
  - `Shipping State/Province`

## New Opportunity

Trigger: Opportunities list or record action -> `New Opportunity`.

Fields and sections:

- Section: `About`
- `Opportunity Name` - required
- `Account Name` - required lookup
- `Close Date` - required date field with date picker
- `Amount` - numeric/currency spinbutton
- `Description`
- `Opportunity Owner` - current user
- Section: `Status`
- `Stage` - required picklist, default `--None--`
- `Probability (%)` - numeric spinbutton
- `Forecast Category` - required picklist, default `--None--`
- `Next Step`

Footer actions:

- `Cancel`
- `Save & New`
- `Save`

## New Product

Trigger: Products list -> `New`.

This flow is a multi-step wizard.

Current stage:

- `New Product - Current Stage`
- Next stage: `New Price Book Entry - Stage Not Started`
- Progress: `0%`

Fields:

- `Product Name` - required
- `Product Family` - picklist, default `--None--`
- `Product Code`
- `Product SKU`
- `Active` - checkbox
- `Product Description`

Footer actions:

- `Cancel`
- `Next`

Rebuild requirement: after product details, continue to a price book entry step before final completion.

## New Price Book

Trigger: Price Books list -> `New`.

Fields:

- `Price Book Name` - required
- `Active` - checkbox
- `Description`
- `Is Standard Price Book` - read-only false value
- `Valid From`
  - Date input
  - Date picker button
  - Time combobox/input
- `Valid To`
  - Date input
  - Date picker button
  - Time combobox/input

## New Case

Trigger: Cases list -> `New`.

Fields and sections:

- Section: `Case Information`
- `Status` - required picklist, default `New`
- `Case Origin` - picklist, default `--None--`
- `Priority` - picklist, default `Medium`
- `Case Owner` - current user
- Section: `Contact Information`
  - `Contact Name` - lookup
  - `Account Name` - lookup
- Section: `Description Information`
  - `Subject`
  - `Description`
  - `Send notification email to contact` - checkbox

Footer actions:

- `Cancel`
- `Save & New`
- `Save`

## New Quick Text

Trigger: Quick Text -> `New Quick Text`.

Dialog:

- Header: `New Quick Text`
- Top-right action: `Cancel and close`
- Required legend: `*= Required Information`
- Footer actions:
  - `Preview`
  - `Cancel`
  - `Save & New`
  - `Save`

Fields and sections:

- `Quick Text Name` - required text field.
- `Message` - required message body.
- `Insert Merge Field` - opens an insertion helper for dynamic values.
- Merge field helper copy: a merge field inserts the value of a field for a specific object, for example `{!Contact.FirstName}`.
- Merge field helper controls:
  - `Related To` - chooser, default `Choose...`.
  - `Field` - chooser, default `Choose...`.
  - `Insert` - inserts the selected merge token into the message.
- `Folder` - folder selector, default `Select Folder`.
- `Category` - category field, observed value `Greetings`.
- `Channel` - dual-list selector:
  - Instruction text: use Ctrl/Cmd plus arrow keys to move items between lists, single-character navigation is supported, Ctrl+Space selects an option.
  - Available list: `Event`, `Task`, `CaseComment`, `Knowledge`.
  - Selected list: `Email`.
  - Movement controls: `Move selection to Selected`, `Move selection to Available`, `Move selection up`, `Move selection down`.
- `Include in selected channels` - checkbox/control.

Rebuild requirement: implement Quick Text as a reusable snippet editor with channel targeting, folder/category assignment, preview, and merge-field insertion.

## New Event

Trigger: Calendar -> `New Event`.

Dialog:

- Header: `New Event`
- Top-right action: `Cancel and close`
- Required legend: `*= Required Information`
- Footer actions:
  - `Cancel`
  - `Save & New`
  - `Save`

Fields and sections:

- `Subject` - required combobox/text field.
  - Initial empty state shows inline validation: `Complete this field.`
  - Observed subject quick choices: `Call`, `Email`, `Meeting`, `Send Letter/Quote`, `Other`.
- `Description` - long text field.
  - Helper tip: type Control + period to insert quick text.
- Section: `Start`
  - `Date` - required date field with date picker button.
  - `Time` - required time combobox, default current slot.
- Section: `End`
  - `Date` - required date field with date picker button.
  - `Time` - required time combobox, default one hour after start.
- `Attendees`
  - Tab: `People`.
  - Search input placeholder: `Search People...`.
  - Current user appears as an attendee suggestion/selection.
- Section: `Related Records`
  - `Name` - polymorphic lookup. Object selector options observed: `Contacts`, `Leads`.
  - `Related To` - polymorphic lookup. Default object `Accounts`; many related object types are available.
  - `Assigned To` - required lookup, default current user.
- Section: `Additional Information`
  - `Location`
  - `Show Time As` - default `Busy`.
  - `All-Day Event` - checkbox.
  - `Private` - checkbox.
  - Private event notice: private details remain visible to the Salesforce admin and users with `View All Data`.

Time picker behavior:

- Time dropdowns show 15-minute increments across a full day.
- The observed org displays localized date/time formatting based on the browser/user locale.

The dialog is tied to the current calendar date/week context. Opening it from the July 8, 2026 week view prefilled start/end dates for July 8, 2026 and a one-hour duration.

## New Knowledge

Trigger: Knowledge list -> `New`.

Fields and sections:

- Section: `Information`
- `Title` - required
- `URL Name` - required
- `Article Body` - rich text editor
- Section: `Visibility`
  - `Visible In Internal App` - checkbox, observed true
  - `Visible to Customer` - checkbox
- Section: `Details`
  - `Article Created Date`
  - `Created By`
  - `Article Archived Date`
  - `Last Modified By`
  - `Article Total View Count`
  - `Archived By`

Rich text editor capabilities observed:

- Menus: `File`, `Edit`, `Insert`, `View`, `Format`, `Table`, `Tools`, `Help`
- Toolbar:
  - `Fullscreen`
  - `Redo` disabled initially
  - `Undo` disabled initially
  - Paragraph format selector
  - `Bold`
  - `Italic`
  - `Underline`
  - `Strikethrough`
  - Text color
  - Background color
  - Clear formatting
  - Align left
  - Align center
  - Align right
  - Justify
  - Reveal/hide additional toolbar items
  - Word count, initially `0 words`

Footer actions:

- `Cancel`
- `Save & New`
- `Save`

## Send List Email

Trigger: Marketing/List Emails -> `Send Email`.

First step: `Select an Email Layout`.

Tabs/options:

- `Layout Options`
- `Saved Emails`

Search:

- Placeholder: `Search...`

Available layouts:

- `Sales` - targeted outreach to sales leads.
- `Announcement` - important updates or big events.
- `Newsletter` - regular updates or brand promotion.
- `Rich Text` - simple text-only layout for quick clear messages.
- `Create with HTML` - custom HTML email.
- `Plain Text` - compose plain text emails from scratch.

Controls:

- Six radio inputs, one per layout.
- `Preview`
- `Select & Continue`
- `Cancel and close`

Rebuild requirement: implement this as a wizard. Step 1 chooses a layout, step 2 should compose the selected email, choose recipients, preview, and send/schedule.
