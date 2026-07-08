# Record Pages And Activity

## Shared Record Page Layout

Record pages use a Lightning record page layout:

- Console/app tabs at top.
- Record type and record name in a highlights panel.
- Primary record actions in the highlights panel.
- Key fields displayed under the highlights panel.
- Main content uses tabs:
  - `Related`
  - `Details`
- Right or lower activity area:
  - `Activity`
  - `Activity Publisher`
  - `Activity Timeline`

Common activity actions:

- `Email`
- `More Email Actions`
- `New Event`
- `More New Event Actions`
- `Log a Call`
- `New Task`

Common activity timeline controls:

- `Only show activities with insights`
- Filter summary such as `Within 2 months - All activities - All types`
- `Timeline Settings`
- `Refresh`
- `Expand All`
- `Upcoming & Overdue`
- Empty state: `No activities to show. Get started by sending an email, scheduling a task, and more.`
- `Show All Activities`

## Contact Record Page

Observed record type: `Contact`.

Highlights panel:

- Record heading format: `Contact [salutation/full name]`
- Actions:
  - `View Contact Hierarchy`
  - `New Opportunity`
  - `Edit`
  - `Delete`
- Key fields in highlights:
  - `Account Name`
  - `Title`
  - `Phone`
  - `Email`
- Account link has `Preview`.

Related tab:

- Duplicate check message:
  - `We found no potential duplicates of this Contact.`
- Related lists:
  - `Opportunities (0)`
    - Action: `New`
  - `Cases (0)`
    - Action: `New`
  - `Files (0)`
    - Action: `Add Files`
    - Drop zone: `Drop Files`
    - Action: `Upload Files`
    - Copy: `Or drop files`
  - `Notes & Attachments (0)`
    - Action: `Upload Files`
    - Drop zone: `Drop Files`
    - Copy: `Or drop files`

Details tab sections and fields:

- Section: `About`
  - `Name`
  - `Account Name`
  - `Title`
  - `Reports To`
  - `Description`
  - `Contact Owner`
- Section: `Get in Touch`
  - `Phone`
  - `Email`
  - `Mailing Address`
- Section: `History`
  - `Created By`
  - `Last Modified By`

Inline edit controls:

- `Edit Name`
- `Edit Account Name`
- `Edit Title`
- `Edit Reports To`
- `Edit Description`
- `Change Owner`
- `Edit Phone`
- `Edit Email`
- `Edit Mailing Address`

## Account Record Page

Observed record type: `Account`.

Highlights panel:

- Record heading format: `Account [account name]`
- Actions:
  - `View Account Hierarchy`
  - `New Contact`
  - `New Opportunity`
  - `Edit`
  - `Show more actions`
- Key fields:
  - `Phone`
  - `Website`
  - `Billing Address`
  - `Account Owner`
- Owner link has `Preview`.
- Owner can be changed through `Change Owner`.

Related tab:

- Duplicate check message:
  - `We found no potential duplicates of this Account.`
- Related lists:
  - `Contacts (1)`
    - Action: `New`
    - Card row for a contact with fields:
      - `Title`
      - `Email`
      - `Phone`
    - Row action: `Show Actions`
    - Link: `View All Contacts`
  - `Opportunities (0)`
    - Action: `New`
  - `Cases (0)`
    - Action: `New`
  - `Partners (0)`
    - Action: `New`
  - `Files`
  - `Notes & Attachments`

Details tab sections and fields:

- Section: `About`
  - `Account Name`
  - `Website`
  - `Type`
  - `Description`
  - `Parent Account`
  - `Account Owner`
- Section: `Get in Touch`
  - `Phone`
  - `Billing Address`
  - `Shipping Address`
- Section: `History`
  - `Created By`
  - `Last Modified By`

Inline edit controls:

- `Edit Account Name`
- `Edit Website`
- `Edit Type`
- `Edit Description`
- `Edit Parent Account`
- `Change Owner`
- `Edit Phone`
- `Edit Billing Address`
- `Edit Shipping Address`

## Record Relationships

The observed data model has these active relationships:

- Account has many Contacts.
- Contact belongs to an Account.
- Account and Contact can have Opportunities.
- Account and Contact can have Cases.
- Account can have Partners.
- Record pages support Files and Notes/Attachments.
- Records support activities: emails, events, calls, and tasks.

## File Upload Surfaces

The Contact record related tab exposed upload surfaces:

- `Add Files`
- `Upload Files`
- Drag-and-drop zones with `Drop Files`
- Text: `Or drop files`

Rebuild requirement:

- Support click-to-upload and drag-and-drop for related files.
- Show related file count.
- Keep Files and Notes/Attachments as separate related areas.

## Duplicate Checks

Both inspected record pages show duplicate detection messages:

- Contact: no potential duplicates found.
- Account: no potential duplicates found.

Rebuild requirement:

- Include a duplicate-check panel on record related pages.
- It should show either a no-duplicates message or a list of possible duplicates with merge/review actions.
