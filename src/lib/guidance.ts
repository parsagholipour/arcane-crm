export type BuiltInGuidanceItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  target: string;
};

export const BUILT_IN_GUIDANCE_ITEMS: readonly BuiltInGuidanceItem[] = [
  {
    id: "lead",
    title: "Add a lead",
    body: "First enter and save a few details about the lead. You can add a sample lead, snooze this guidance, drag it, or dismiss it.",
    href: "/lightning/o/Lead/list?filterName=AllOpenLeads",
    target: "Lead"
  },
  {
    id: "marketing",
    title: "Turn on marketing features",
    body: "Activate marketing, then send your first list email.",
    href: "/lightning/app/marketing",
    target: "Marketing"
  },
  {
    id: "deal",
    title: "Create your first deal",
    body: "Create an opportunity and update the stage as work progresses.",
    href: "/lightning/o/Opportunity/list",
    target: "Opportunity"
  }
];

export function builtInGuidanceItemById(id: string) {
  return BUILT_IN_GUIDANCE_ITEMS.find((item) => item.id === id);
}
