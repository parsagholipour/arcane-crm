# Top-Level Apps

## Home

Two Home states were observed depending on app context.

### Starter Onboarding Home

This Home appears as a starter onboarding dashboard.

Visible sections and controls:

- Heading: `Welcome, [first name]`
- Subheading: `Check out these suggestions to kick off your day.`
- Button: `Hide suggestions`
- Link/button: `View All Cards`
- Suggestion cards:
  - `Create your first lead`
    - Copy: convert leads into contacts, accounts, and opportunities.
    - Dismiss action: `Dismiss this suggestion`
  - `Turn on marketing features`
    - Has `Open in new tab` affordance.
    - Copy: access tools to reach audiences and engage customers.
    - Dismiss action.
  - `Create your first deal`
    - Copy: add an opportunity and track stages as deals move forward.
    - Dismiss action.
- Report chart selectors:
  - `Select a Leads report...`
  - `Select an Opportunities report...`
  - `Select a Contacts report...`
  - `Select a Cases report...`
- Each report area has a `New` action and `View Report` affordance.
- `Recent Records`
- `Make It Your Home`

### Sales-Style Home Dashboard

Another Home view appeared inside the console workspace.

Visible sections and controls:

- `Quarterly Performance`
  - `As of Today [time]`
  - `Refresh Chart`
  - Metrics: `Closed`, `Open (>70%)`, `Goal`
  - `Edit Goal`
  - Empty chart copy: add opportunities and return to view performance.
- `Today's Events`
  - Empty state: free/clear for the day.
  - `View Calendar`
- `Recent Records`
  - Shows recently accessed reports, contacts, and accounts.
  - `View All`
- `Today's Tasks`
  - View selector: `Select a view of your tasks`
  - Empty state: nothing due today.
  - `View All`
- `Key Deals - Recent Opportunities`
  - Empty state when no deals match.
- `Assistant`
  - Empty state: nothing needs attention.

## Contacts App

Purpose: dedicated Contact workspace.

Default visible page:

- Object: `Contacts`
- List view: `Recently Viewed`
- URL pattern: `/lightning/o/Contact/list?filterName=Recent` or `__Recent`
- Actions:
  - `Import`
  - `Add to Campaign`
  - `Send Email`
  - `New`
  - `Assign Label`
- One existing contact row was present and linked to one account.

## Accounts App

Purpose: dedicated Account workspace.

Default visible page:

- Object: `Accounts`
- List view: `Recently Viewed`
- URL pattern: `/lightning/o/Account/list?filterName=Recent` or `__Recent`
- Actions:
  - `New`
  - `Import`
  - `Assign Label`
- One existing account row was present.

## Sales App

Purpose: sales pipeline workspace centered on leads and opportunities.

Default visible page:

- Object: `Leads`
- List view: `All Open Leads`
- URL: `/lightning/o/Lead/list?filterName=AllOpenLeads`
- Actions:
  - `New`
  - `Import`
  - `Add to Campaign`
  - `Send Email`
  - `Change Owner`
  - `Show more actions`
- Empty-state/onboarding card:
  - Heading: `Focus on the right leads`
  - Copy: Salesforce helps focus sales efforts by keeping prospecting information organized.
- In-app guidance prompt:
  - `Add a lead`
  - Copy: enter and save a few details about the lead.
  - Suggestion: add a sample lead.
  - Controls: `Snooze In-App Guidance`, `Drag and Drop`, `Dismiss`

Sales subareas are listed in [01-shell-and-navigation.md](01-shell-and-navigation.md).

## Service App

Purpose: support workspace centered on cases.

Default visible page:

- Object: `Cases`
- List view: `All Open Cases`
- URL: `/lightning/o/Case/list?filterName=AllOpenCases`
- Actions:
  - `New`
  - `Change Owner`
  - `Merge Cases`
  - `Printable View` on the all-open view
  - `Assign Label`
- Empty-state/onboarding copy:
  - Heading: `Track customer support in one place`

Service subareas are listed in [01-shell-and-navigation.md](01-shell-and-navigation.md).

## Marketing App

Purpose: activate marketing tools and send list emails.

URL: `/lightning/n/standard-MarketingAppOverview`

Visible content:

- Heading: `Activate powerful marketing tools and boost sales`
- Copy: accelerate lead generation with campaigns and analytics.
- Activation call to action: `Activate Marketing`
- Section: `Send emails with ease`
  - Explains access to Sales List Emails for leads and contacts.
  - Button/action: `Send Email`
- Section: `Activate Your Growth Engines`
- Feature tiles/headings:
  - `Email Campaigns`
  - `Custom Landing Pages with Forms`
  - `Audience Building`
  - `Pre-Built Analytics`
- Child nav: `List Emails`

## Commerce App

Purpose: store setup.

URL: `/lightning/n/standard-CommerceStores`

Visible content:

- Heading: `You don't have any stores yet!`
- Copy explains that a store holds product, payment, order, and promotion data.
- Primary action: `Create Store`

## Your Account App

Purpose: subscription, plan, license, and billing management.

URL: `/lightning/n/standard-OnlineSalesHome`

Visible content:

- Heading: `You haven't subscribed yet`
- Copy: after subscribing, the user can manage plan, licenses, and billing information here.
- Primary action: `Buy Now`
