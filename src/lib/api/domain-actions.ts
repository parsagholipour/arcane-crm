import { apiRequest, jsonBody } from "@/lib/api/client";
import type { CrmObject, RecordData } from "@/lib/crm-types";

export type DomainActionName =
  | "Assign Label"
  | "Add to Campaign"
  | "Change Owner"
  | "Add to Category"
  | "Convert Lead"
  | "New Folder"
  | "Create Store"
  | "Activate Marketing"
  | "Publish"
  | "Assign"
  | "Archive"
  | "Delete Article"
  | "Delete Draft"
  | "Restore"
  | "Merge Cases";

const actionPaths: Record<DomainActionName, string> = {
  "Assign Label": "/api/actions/labels",
  "Add to Campaign": "/api/actions/campaign-members",
  "Change Owner": "/api/actions/ownership",
  "Add to Category": "/api/actions/product-categories",
  "Convert Lead": "/api/actions/lead-conversion",
  "New Folder": "/api/actions/quick-text-folders",
  "Create Store": "/api/actions/commerce-stores",
  "Activate Marketing": "/api/actions/marketing-activation",
  Publish: "/api/actions/knowledge/publish",
  Assign: "/api/actions/knowledge/assign",
  Archive: "/api/actions/knowledge/archive",
  "Delete Article": "/api/actions/knowledge/delete",
  "Delete Draft": "/api/actions/knowledge/delete-draft",
  Restore: "/api/actions/knowledge/restore",
  "Merge Cases": "/api/actions/case-merge"
};

export async function executeDomainAction(input: {
  action: DomainActionName;
  object: CrmObject;
  selectedIds: string[];
  values: RecordData;
}) {
  return apiRequest<RecordData>(actionPaths[input.action], {
    method: "POST",
    body: jsonBody({
      object: input.object,
      selectedIds: input.selectedIds,
      values: input.values
    })
  });
}
