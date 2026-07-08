# Shell And Navigation

## Product Shell

The app uses Salesforce Lightning styling and layout:

- Full viewport web application with a fixed dark-blue vertical navigation rail on the far left.
- Main content starts to the right of the rail.
- A pale green trial/purchase banner spans the top:
  - Text: `Don't wait: Save 70% now with code STARTER70 | Terms apply.`
  - Primary button: `Buy Now`.
  - Trial countdown text: `Days left in your Trial: 30`.
- Global header below the banner:
  - Salesforce cloud logo at left.
  - Center global search button/input labeled `Search...`.
  - Right-side utility icons/buttons:
    - `Agentforce`
    - `Guidance Center`
    - `Salesforce Help`
    - `Quick Settings`
    - `Notifications`, sometimes with `1 new notifications`
    - `View profile`

## Primary Left Rail

The left rail is icon plus label navigation. Items are vertically stacked and use a highlighted active state.

Top-level items:

| Label | Purpose | Observed URL pattern |
| --- | --- | --- |
| Home | CRM home/dashboard and onboarding cards | `/lightning/app/06ma30014LcoriuAQA`, redirects to `/lightning/page/home` |
| Contacts | Contact list workspace | `/lightning/app/06ma30014Ld9qS4AQI` |
| Accounts | Account list workspace | `/lightning/app/06ma30014Ld5eJ2AQI` |
| Sales | Sales workspace, leads-first | `/lightning/app/06ma30014LcgTQqAQM` |
| Service | Service workspace, cases-first | `/lightning/app/06ma30014LckfZsAQI` |
| Marketing | Marketing activation and list emails | `/lightning/app/06ma30014IBEbx6AQD` |
| Commerce | Store setup | `/lightning/app/06ma30014LcxG0yAQE` |
| Your Account | Subscription/billing area | `/lightning/app/06ma30014LcPgqiAQC` |

## Secondary App Navigation

Each selected top-level app shows a horizontal app header near the top of the content area:

- App title, such as `Contacts`, `Sales`, or `Service`.
- One or more app tabs, such as `Contacts`, `Leads`, `Cases`, `List Emails`.
- A dropdown caret for more navigation items when the app has many tabs.
- `Edit nav items` icon/button to personalize the current nav bar.

When pages are opened directly or from records, the app can enter a console-like tab bar:

- Each open item appears as a tab with an asterisk prefix in the accessible text.
- Tabs expose a matching `List` button and a `Close tab` button.
- Example open tabs observed: `Leads`, `Recently Viewed | Contacts`, `Robert | Account`, `Opportunities`, `Products`, `Price Books`, `Calendar`, `Home`.
- A `More` navigation tab appears when too many tabs are open.

## Sales App Subnavigation

Sales exposes these child destinations:

| Label | URL |
| --- | --- |
| Leads | `/lightning/o/Lead/home` |
| Contacts | `/lightning/o/Contact/home` |
| Accounts | `/lightning/o/Account/home` |
| Opportunities | `/lightning/o/Opportunity/home` |
| Products | `/lightning/o/Product2/home` |
| Price Books | `/lightning/o/Pricebook2/home` |
| Calendar | `/lightning/o/Event/home` |
| Analytics | `/lightning/page/analytics` |
| Invoices | `/lightning/o/Invoice/home` |
| Video Calls | `/lightning/o/VideoCall/home` |

## Service App Subnavigation

Service exposes these child destinations:

| Label | URL |
| --- | --- |
| Cases | `/lightning/o/Case/home` |
| Contacts | `/lightning/o/Contact/home` |
| Accounts | `/lightning/o/Account/home` |
| Quick Text | `/lightning/o/QuickText/home` |
| Messaging Sessions | `/lightning/o/MessagingSession/home` |
| Analytics | `/lightning/page/analytics` |
| Knowledge | `/lightning/o/Knowledge__kav/home` |

## Marketing App Subnavigation

Marketing exposes:

| Label | URL |
| --- | --- |
| Marketing overview | `/lightning/n/standard-MarketingAppOverview` |
| List Emails | `/lightning/o/ListEmail/home` |

## Global Search

Clicking `Search...` opens a dropdown/overlay with suggested recent or semantic searches and records.

Observed suggestions included:

- `Robert accounts`
- `accounts with account type customer`
- `Robert contacts`
- Contact result format: `Contact - Account`
- Account result format: `Account`
- Report results such as `Open Cases for Accounts I Own`, `My Closed Cases by Close Date`, `My Cases Closed MTD`
- List view results such as `All Open Leads`, `All Open Cases`, `All List Emails`

Rebuild behavior:

- Search should be globally available from every screen.
- It should index records, reports, and list views.
- It should show recent/suggested searches before typing.
- Search result rows should show object/type context.

## Header Utilities

Observed utility buttons are present in the global header:

- `Agentforce`: AI assistant entry point.
- `Guidance Center`: learning/help panel.
- `Salesforce Help`: help entry point.
- `Quick Settings`: settings shortcut.
- `Notifications`: notification center with unread count.
- `View profile`: user profile menu.

These menus did not consistently expose their panel text through automation, but the buttons are part of the required shell.
