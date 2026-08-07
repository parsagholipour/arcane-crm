INSERT INTO "GuidanceItem" ("id", "title", "body", "href", "target")
VALUES
  (
    'lead',
    'Add a lead',
    'First enter and save a few details about the lead. You can add a sample lead, snooze this guidance, drag it, or dismiss it.',
    '/lightning/o/Lead/list?filterName=AllOpenLeads',
    'Lead'
  ),
  (
    'marketing',
    'Turn on marketing features',
    'Activate marketing, then send your first list email.',
    '/lightning/app/marketing',
    'Marketing'
  ),
  (
    'deal',
    'Create your first deal',
    'Create an opportunity and update the stage as work progresses.',
    '/lightning/o/Opportunity/list',
    'Opportunity'
  )
ON CONFLICT ("id") DO NOTHING;
