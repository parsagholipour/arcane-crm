"use client";

import { useListViewController, type ListViewPageProps } from "@/features/crm/list-page-controller";
import { ListView } from "@/features/crm/list-page-view";
import { QuickTextPage } from "@/features/crm/quick-text";

export function ListViewPage(props: ListViewPageProps) {
  if (props.object === "QuickText") {
    return (
      <QuickTextPage
        data={props.data}
        onCreate={() => props.onCreate("QuickText")}
        onCreateFolder={() => props.onListAction("New Folder", "QuickText", props.records, [])}
        onEdit={(record) => props.onEdit("QuickText", record)}
        onDelete={(record) => props.onDelete("QuickText", record)}
        onDataChange={props.onDataChange}
        onToast={props.onToast}
      />
    );
  }
  return <StandardListView {...props} />;
}

function StandardListView(props: ListViewPageProps) {
  const model = useListViewController(props);
  return <ListView model={model} />;
}
