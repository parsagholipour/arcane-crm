# Raw Observation Log

This log captures compact, normalized snippets from the live Salesforce Lightning UI. It is not a prose spec; it is evidence for the details in the other files.

Text is normalized to ASCII. The live org/browser displayed some dates and times with localized numerals; those are described rather than copied.

## Global Shell

Persistent banner:

```text
Don't wait: Save 70% now with code STARTER70 | Terms apply.
Buy Now
Days left in your Trial: 30
```

Global header controls:

```text
Home
Search...
Agentforce
Guidance Center
Salesforce Help
Quick Settings
Notifications
View profile
```

Left app rail:

```text
Home
Contacts
Accounts
Sales
Service
Marketing
Commerce
Your Account
```

Console tab examples observed during crawl:

```text
* Leads
Leads List
Close tab
* Rober Antonio | Contact
Rober Antonio | Contact List
Close tab
* Robert | Account
Robert | Account List
Close tab
* Opportunities
Opportunities List
Close tab
* Products
Products List
Close tab
* Price Books
Price Books List
Close tab
* Calendar
Calendar List
Close tab
* More
Show more navigation items
Edit nav items
```

## Home

Onboarding home snippets:

```text
Welcome
Check out these suggestions to kick off your day.
Hide suggestions
View All Cards
Create your first lead
Turn on marketing features
Create your first deal
Leads
Opportunities
Contacts
Cases
View Report
Recent Records
Make It Your Home
```

Dashboard home snippets:

```text
Quarterly Performance
Refresh Chart
Closed
Open (>70%)
Goal
Edit Goal
Today's Events
View Calendar
Recent Records
Today's Tasks
Key Deals - Recent Opportunities
Assistant
```

## Top-Level App Pages

Contacts app:

```text
Contacts
Recently Viewed
Import
Add to Campaign
Send Email
New
Assign Label
```

Accounts app:

```text
Accounts
Recently Viewed
New
Import
Assign Label
```

Sales app:

```text
Leads
All Open Leads
New
Import
Add to Campaign
Send Email
Change Owner
Show more actions
Focus on the right leads
Add a lead
```

Service app:

```text
Cases
All Open Cases
New
Change Owner
Merge Cases
Printable View
Assign Label
Track customer support in one place
```

Marketing app:

```text
Activate powerful marketing tools and boost sales
Activate Marketing
Send emails with ease
Send Email
Activate Your Growth Engines
Email Campaigns
Custom Landing Pages with Forms
Audience Building
Pre-Built Analytics
```

Commerce app:

```text
You don't have any stores yet!
Create Store
```

Your Account app:

```text
You haven't subscribed yet
Buy Now
```

## Shared List View Text

List framework snippets:

```text
Select a List View
Pin this list view.
This list is pinned.
Search this list...
List View Controls
Select list display
Refresh
Column sort
Edit List
Charts
Filters
Nothing to see here
There's nothing in your list yet. Try adding a new record.
```

Column sort disabled message:

```text
Column sort is disabled. To sort columns, a list view needs at least one row and two columns.
```

List view controls menu:

```text
New
Clone
Rename
Sharing Settings
Select Fields to Display
Delete
Reset Column Sorting
Reset Column Widths
```

Display selector:

```text
Table
Kanban
```

Contact list selector:

```text
Search lists...
Recent List Views
Recently Viewed (Pinned list)
All Other Lists
All Contacts
Birthdays This Month
My Contacts
New This Week
Recently Viewed Contacts
```

Knowledge list selector:

```text
All Articles
Archived Articles
Draft Articles
Published Articles
Recently Viewed (Pinned list)
```

List Email list selector:

```text
All List Emails
My List Emails
Recently Viewed (Pinned list)
```

## Object Lists

Contacts columns/actions:

```text
Name
Account Name
Phone
Email
Contact Owner Alias
Action
Edit Account Name
Edit Phone
Edit Email
Show Actions
```

Accounts columns/actions:

```text
Account Name
Phone
Account Owner Alias
Action
Edit Account Name
Edit Phone
Show Actions
```

All Open Leads columns:

```text
Name
Company
State/Province (text only)
Phone
Email
Lead Status
Created Date
Owner Alias
Action
```

All Open Cases columns:

```text
Case Number
Contact Name
Subject
Status
Priority
Date/Time Opened
Case Owner Alias
Action
```

Knowledge columns/actions:

```text
Article Title
Summary
Article Number
Published Date
Publication Status
Validation Status
Action
New
Publish
Assign
Archive
Delete Article
Delete Draft
Restore
Change Owner
```

Quick Text manager:

```text
New Quick Text
New Folder
Personalize your list view settings.
Search recent quick text...
QUICK TEXT
Recent
All Quick Text
FOLDERS
All Folders
Created by Me
Shared with Me
FAVORITES
All Favorites
```

Calendar:

```text
July 4, 2026-July 10, 2026
GMT +4
Previous Week
Next Week
Today
Refresh
View
New Event
Show Sidebar
All-Day Events
My Calendars
Other Calendars
```

## Create And Edit Modals

Shared modal text:

```text
Cancel and close
* = Required Information
Cancel
Save & New
Save
```

New Lead:

```text
New Lead
About
*Lead Status New
*Name
Salutation --None--
First Name
*Last Name
*Company
Title
Website
Description
Lead Owner Parsa Gholipourjamnani
Rating --None--
Get in Touch
Phone
Email
Address
Country
Street
Zip/Postal Code
City
State/Province
Segment
No. of Employees
Annual Revenue
Lead Source --None--
Industry --None--
```

New Contact:

```text
New Contact
About
*Name
Salutation --None--
First Name
*Last Name
*Account Name
Title
Reports To
Description
Contact Owner Parsa Gholipourjamnani
Get in Touch
Phone
Email
Mailing Address
Mailing Country
Mailing Street
Mailing Zip/Postal Code
Mailing City
Mailing State/Province
```

Edit Contact:

```text
Edit Rober Antonio
About
*Name
Salutation Mr.
First Name
*Last Name
*Account Name Account
Clear Account Name Selection
Title
Reports To
Description
Contact Owner Parsa Gholipourjamnani
Get in Touch
Phone
Email
Mailing Address
Mailing Country
Mailing Street
Mailing Zip/Postal Code
Mailing City
Mailing State/Province
History
Created By
Last Modified By
```

New Account:

```text
New Account
About
*Account Name
Website
Type --None--
Description
Parent Account
Account Owner Parsa Gholipourjamnani
Get in Touch
Phone
Billing Address
Billing Country
Billing Street
Billing Zip/Postal Code
Billing City
Billing State/Province
Shipping Address
Shipping Country
Shipping Street
Shipping Zip/Postal Code
Shipping City
Shipping State/Province
```

Edit Account:

```text
Edit Robert
About
*Account Name
Website
Type Customer
Description
Parent Account
Account Owner Parsa Gholipourjamnani
Get in Touch
Phone
Billing Address
Billing Country
Billing Street
Billing Zip/Postal Code
Billing City
Billing State/Province
Shipping Address
Shipping Country
Shipping Street
Shipping Zip/Postal Code
Shipping City
Shipping State/Province
History
Created By
Last Modified By
```

New Opportunity:

```text
New Opportunity
About
*Opportunity Name
Opportunity Name
Complete this field.
*Account Name
*Close Date
Select a date for Close Date
Amount
Description
Opportunity Owner Parsa Gholipourjamnani
Status
*Stage --None--
Probability (%)
*Forecast Category --None--
Next Step
```

New Case:

```text
New Case
Case Information
*Status New
Case Origin --None--
Priority Medium
Case Owner Parsa Gholipourjamnani
Contact Information
Contact Name
Account Name
Description Information
Subject
Description
Send notification email to contact
```

New Product:

```text
New Product - Current Stage
New Price Book Entry - Stage Not Started
0%
Product Name
Product Family --None--
Product Code
Product SKU
Active
Product Description
Cancel
Next
```

New Price Book:

```text
New Price Book
Price Book Name
Active
Description
Is Standard Price Book False
Valid From
Valid To
Cancel
Save & New
Save
```

New Event:

```text
New Event
*Subject
Subject
Complete this field.
Description
Tip: Type Control + period to insert quick text.
Start
*Date
*Time
End
*Date
*Time
Attendees
People
Auto Complete Label
Parsa Gholipourjamnani
Related Records
Name
Pick an object
Related To
Pick an object
Assigned To *
Assigned To - Current Selection: Parsa Gholipourjamnani (User)
Additional Information
Location
Show Time As Busy
All-Day Event
Private
Private event details are also visible to your Salesforce admin and users with the View All Data permission.
```

New Quick Text:

```text
New Quick Text
Quick Text Name *
Message *
Insert Merge Field
A merge field lets you insert the value of a field for a specific object.
Related To Choose...
Field Choose...
Insert
Folder Select Folder
Category Greetings
Channel
Available
Event
Task
CaseComment
Knowledge
Selected
Email
Include in selected channels
Preview
Cancel
Save & New
Save
```

New Knowledge:

```text
New Knowledge
Information
Title
URL Name
Article Body
Visibility
Visible In Internal App
Visible to Customer
Details
Article Created Date
Created By
Article Archived Date
Last Modified By
Article Total View Count
Archived By
File
Edit
Insert
View
Format
Table
Tools
Help
Fullscreen
Redo
Undo
Paragraph
Bold
Italic
Underline
Strikethrough
Text color
Background color
Clear Formatting
Align left
Align center
Align right
Justify
0 words
```

List Email layout picker:

```text
Select an Email Layout
Layout Options
Saved Emails
Search...
Sales
Announcement
Newsletter
Rich Text
Create with HTML
Plain Text
Preview
Select & Continue
Cancel and close
```

## Picklist Observations

Lead Status:

```text
--None--
New
Contacted
Nurturing
Qualified
Unqualified
```

Salutation:

```text
--None--
Mr.
Ms.
Mrs.
Dr.
Prof.
Mx.
```

Lead Rating:

```text
--None--
Hot
Warm
Cold
```

Lead Source:

```text
--None--
Advertisement
Employee Referral
External Referral
Partner
Public Relations
Seminar - Internal
Seminar - Partner
Trade Show
Web
Word of mouth
Other
```

Account Type:

```text
--None--
Analyst
Competitor
Customer
Integrator
Investor
Partner
Press
Prospect
Reseller
Other
```

Opportunity Stage:

```text
--None--
Qualify
Meet & Present
Propose
Negotiate
Closed Won
Closed Lost
```

Case picklists:

```text
Status: --None--, New, Working, Waiting on Customer, Escalated, Closed
Case Origin: --None--, Email, Phone, Web
Priority: --None--, High, Medium, Low
```

Event Subject:

```text
Call
Email
Meeting
Send Letter/Quote
Other
```

Product Family:

```text
--None--
None
```

## Record Pages

Contact record:

```text
Contact Mr. Rober Antonio
View Contact Hierarchy
New Opportunity
Edit
Delete
Account Name
Title
Phone
Email
Related
Details
We found no potential duplicates of this Contact.
Opportunities (0)
Cases (0)
Files (0)
Notes & Attachments (0)
Add Files
Upload Files
Drop Files
Or drop files
About
Name
Account Name
Title
Reports To
Description
Contact Owner
Get in Touch
Phone
Email
Mailing Address
History
Created By
Last Modified By
```

Account record:

```text
Account Robert
View Account Hierarchy
New Contact
New Opportunity
Edit
Show more actions
Phone
Website
Billing Address
Account Owner
Related
Details
We found no potential duplicates of this Account.
Contacts (1)
Opportunities (0)
Cases (0)
Partners (0)
Files
Notes & Attachments
View All Contacts
About
Account Name
Website
Type
Description
Parent Account
Account Owner
Get in Touch
Phone
Billing Address
Shipping Address
History
Created By
Last Modified By
```

Activity:

```text
Activity
Email
More Email Actions
New Event
More New Event Actions
Log a Call
New Task
Only show activities with insights
Within 2 months - All activities - All types
Timeline Settings
Refresh
Expand All
Upcoming & Overdue
No activities to show. Get started by sending an email, scheduling a task, and more.
Show All Activities
```

## Global Search

Observed suggestions/results:

```text
Robert accounts
accounts with account type customer
Robert contacts
Contact - Account
Account
Open Cases for Accounts I Own
My Closed Cases by Close Date
My Cases Closed MTD
All Open Leads
All Open Cases
All List Emails
```

## Navigation URLs Observed

Top-level app URLs:

```text
Home: /lightning/app/06ma30014LcoriuAQA
Contacts: /lightning/app/06ma30014Ld9qS4AQI
Accounts: /lightning/app/06ma30014Ld5eJ2AQI
Sales: /lightning/app/06ma30014LcgTQqAQM
Service: /lightning/app/06ma30014LckfZsAQI
Marketing: /lightning/app/06ma30014IBEbx6AQD
Commerce: /lightning/app/06ma30014LcxG0yAQE
Your Account: /lightning/app/06ma30014LcPgqiAQC
```

Sales child URLs:

```text
Leads: /lightning/o/Lead/home
Contacts: /lightning/o/Contact/home
Accounts: /lightning/o/Account/home
Opportunities: /lightning/o/Opportunity/home
Products: /lightning/o/Product2/home
Price Books: /lightning/o/Pricebook2/home
Calendar: /lightning/o/Event/home
Analytics: /lightning/page/analytics
Invoices: /lightning/o/Invoice/home
Video Calls: /lightning/o/VideoCall/home
```

Service child URLs:

```text
Cases: /lightning/o/Case/home
Contacts: /lightning/o/Contact/home
Accounts: /lightning/o/Account/home
Quick Text: /lightning/o/QuickText/home
Messaging Sessions: /lightning/o/MessagingSession/home
Analytics: /lightning/page/analytics
Knowledge: /lightning/o/Knowledge__kav/home
```
