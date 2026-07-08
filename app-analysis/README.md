# CRM App Analysis

This folder documents the live app that was open in Chrome on July 8, 2026. The app is a Salesforce Lightning Starter-style CRM trial at `energy-agility-2721.lightning.force.com`.

The goal of these notes is to give an AI builder enough detail to recreate the same functional surface: navigation, work areas, list views, object actions, create/edit forms, record pages, activity tools, and empty states. The analysis was done from the live UI in a read-only way: I opened menus, list views, record pages, create/edit dialogs, picklists, and action menus, then canceled without saving records.

This is intended as a 100% UI-observed reconstruction spec. It documents every visible page, modal, state, button, field, default, picklist, and workflow that could be reached safely from the logged-in Chrome tab. A true Salesforce metadata export would still be needed to prove hidden validation rules, automation, permissions, flows, Apex, and full country/state value sets that are not fully exposed in the UI.

## Files

- [01-shell-and-navigation.md](01-shell-and-navigation.md) - global layout, header, left navigation, app navigation, search, menus, and console tab behavior.
- [02-top-level-apps.md](02-top-level-apps.md) - the Home, Contacts, Accounts, Sales, Service, Marketing, Commerce, and Your Account app areas.
- [03-objects-and-list-views.md](03-objects-and-list-views.md) - object pages, list-view behavior, visible columns, actions, filters, search boxes, and empty states.
- [04-forms-and-workflows.md](04-forms-and-workflows.md) - create dialogs, required fields, buttons, product wizard, list email layout picker, knowledge editor, and support/sales workflows.
- [05-record-pages-and-activity.md](05-record-pages-and-activity.md) - Contact and Account record pages, detail sections, related lists, file upload surfaces, and activity timeline tools.
- [06-ai-rebuild-spec.md](06-ai-rebuild-spec.md) - consolidated rebuild requirements, suggested schema, UI components, permissions, and acceptance criteria.
- [07-field-dictionary-and-picklists.md](07-field-dictionary-and-picklists.md) - object-by-object field inventory, field types, required/default states, lookup behavior, and observed picklist values.
- [08-page-state-and-interaction-spec.md](08-page-state-and-interaction-spec.md) - detailed component states, list-view behavior, modal state machines, console tabs, activity composer, file upload, search, and calendar behavior.
- [09-ai-implementation-blueprint.md](09-ai-implementation-blueprint.md) - route map, component architecture, data model, fixture data, rebuild sequence, and acceptance checklist for an AI implementer.
- [10-raw-observation-log.md](10-raw-observation-log.md) - compact raw screen observations and text snippets from the live UI, normalized to ASCII.

## Important Scope Notes

- This is a feature reconstruction spec, not a Salesforce metadata export.
- Exact private data values are not required for a rebuild. The docs describe object relationships and visible field labels while avoiding unnecessary customer data.
- Salesforce REST metadata endpoints were not available through the browser wrapper, so field/layout details are based on visible Lightning UI, dialogs, menus, and record pages.
- The app includes many Salesforce-standard capabilities. A non-Salesforce rebuild should replicate the behavior and UI patterns, not necessarily Salesforce internal implementation.
- Some large Salesforce-standard lists, such as countries and 15-minute time slots, were sampled from the dropdown UI. The rebuild should implement the full standard lists, while preserving the observed labels, defaults, and behavior.
