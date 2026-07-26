"use client";

import * as Popover from "@radix-ui/react-popover";
import { Bookmark, Edit3, Eye, Search, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { type ScopedCrmData, type RecordData } from "@/lib/crm-types";
import { cn, formatDateTime } from "@/lib/utils";
import { BaseDialog, Button, EmptyPanel, type ToastState } from "@/components/ui/crm-primitives";
import { checkboxClass, FieldShell, inputBareClass, NativeSelect } from "@/features/crm/controls";
import { resourceApi } from "@/lib/api/resources";
import { quickTextMatches, quickTextTimestamp, quickTextViewCount, requiredId } from "@/features/crm/record-model";
import { type ScopedCrmDataUpdater } from "@/features/crm/shared-types";

export function QuickTextPage({
  data,
  onCreate,
  onCreateFolder,
  onEdit,
  onDelete,
  onDataChange,
  onToast
}: {
  data: ScopedCrmData;
  onCreate: () => void;
  onCreateFolder: () => void;
  onEdit: (record: RecordData) => void;
  onDelete: (record: RecordData) => void;
  onDataChange: ScopedCrmDataUpdater;
  onToast: (toast: ToastState) => void;
}) {
  const [activeView, setActiveView] = useState("Recent");
  const [query, setQuery] = useState("");
  const favorites = data.quickTextFavorites.map((favorite) => String(favorite.quickTextId));
  const [previewRecord, setPreviewRecord] = useState<RecordData | null>(null);
  const [showPreviewText, setShowPreviewText] = useState(true);
  const [showFolderColumn, setShowFolderColumn] = useState(true);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const foldersById = new Map(data.quickTextFolders.map((folder) => [String(folder.id), folder]));
  const visibleFolders = data.quickTextFolders.filter((folder) => {
    if (activeView === "Created by Me") return folder.ownerId === data.user.id;
    if (activeView === "Shared with Me")
      return (
        String(folder.sharing ?? "")
          .toLowerCase()
          .includes("shared") ||
        String(folder.sharing ?? "")
          .toLowerCase()
          .includes("public")
      );
    return activeView === "All Folders";
  });
  const filteredRecords = data.quickTexts
    .filter((record) => {
      if (activeView === "All Favorites" && !favorites.includes(requiredId(record))) return false;
      if (["All Folders", "Created by Me", "Shared with Me"].includes(activeView)) {
        const folder = foldersById.get(String(record.folderId ?? ""));
        if (!folder) return false;
        if (activeView === "Created by Me" && folder.ownerId !== data.user.id) return false;
        if (
          activeView === "Shared with Me" &&
          !String(folder.sharing ?? "")
            .toLowerCase()
            .match(/shared|public/)
        )
          return false;
      }
      return quickTextMatches(record, query, foldersById);
    })
    .sort((left, right) => {
      const comparison = quickTextTimestamp(right) - quickTextTimestamp(left);
      return sortDirection === "desc" ? comparison : -comparison;
    })
    .slice(activeView === "Recent" ? 0 : undefined, activeView === "Recent" ? 10 : undefined);
  const sidebarGroups = [
    { title: "QUICK TEXT", items: ["Recent", "All Quick Text"] },
    { title: "FOLDERS", items: ["All Folders", "Created by Me", "Shared with Me"] },
    { title: "FAVORITES", items: ["All Favorites"] }
  ];

  async function toggleFavorite(id: string) {
    const response = await resourceApi.toggleQuickTextFavorite(id);
    if (!Array.isArray(response?.quickTextFavorites)) {
      onToast({ tone: "error", message: "The Quick Text favorite could not be saved." });
      return;
    }
    onDataChange((previous) => ({ ...previous, quickTextFavorites: response.quickTextFavorites as RecordData[] }));
    onToast({
      tone: "success",
      message: response.favorite ? "Quick Text added to favorites." : "Quick Text removed from favorites."
    });
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-lg border border-[#e4e7ec] bg-white p-3 shadow-card">
        <div className="mb-3 flex justify-between">
          <h2 className="font-semibold">QUICK TEXT</h2>
          <Popover.Root>
            <Popover.Trigger asChild>
              <button aria-label="Personalize your list view settings." className="rounded p-1 hover:bg-[#f3f3f3]">
                <Settings size={14} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                className="z-50 w-72 rounded border border-[#d8dde6] bg-white p-3 text-sm shadow-popover"
              >
                <div className="mb-3 font-semibold">List Display Settings</div>
                <label className="mb-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={showPreviewText}
                    onChange={(event) => setShowPreviewText(event.target.checked)}
                  />{" "}
                  Show message preview
                </label>
                <label className="mb-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={showFolderColumn}
                    onChange={(event) => setShowFolderColumn(event.target.checked)}
                  />{" "}
                  Show folder column
                </label>
                <FieldShell label="Sort">
                  <NativeSelect
                    options={["Newest first", "Oldest first"]}
                    value={sortDirection === "desc" ? "Newest first" : "Oldest first"}
                    onChange={(value) => setSortDirection(value === "Newest first" ? "desc" : "asc")}
                  />
                </FieldShell>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        {sidebarGroups.map((group, groupIndex) => (
          <div key={group.title} className={cn(groupIndex > 0 && "mt-4")}>
            {groupIndex > 0 && <h2 className="mb-1 font-semibold">{group.title}</h2>}
            {group.items.map((item) => (
              <button
                key={item}
                onClick={() => setActiveView(item)}
                className={cn(
                  "block w-full rounded px-2 py-2 text-left text-sm hover:bg-brand-50",
                  activeView === item && "bg-brand-50 font-semibold text-brand-900"
                )}
              >
                <span>{item}</span>
                <span className="float-right text-xs text-[#706e6b]">{quickTextViewCount(item, data, favorites)}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>
      <section className="rounded-lg border border-[#e4e7ec] bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde6] p-3">
          <div>
            <h1 className="text-xl font-semibold">Quick Text</h1>
            <div className="text-xs text-[#706e6b]">
              {filteredRecords.length} of {data.quickTexts.length} items - {activeView} - Updated a few seconds ago
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="primary" onClick={onCreate}>
              New Quick Text
            </Button>
            <Button onClick={onCreateFolder}>New Folder</Button>
          </div>
        </div>
        <div className="p-3">
          <div className="mb-3 flex h-8 max-w-sm items-center rounded border border-[#c9c9c9] px-2">
            <Search size={14} className="text-[#706e6b]" />
            <input
              className={inputBareClass}
              placeholder="Search recent quick text..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {visibleFolders.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {visibleFolders.map((folder) => (
                <button
                  key={requiredId(folder)}
                  className="rounded border border-[#d8dde6] p-3 text-left hover:border-brand-500 hover:bg-brand-50"
                  onClick={() => setQuery(String(folder.name ?? ""))}
                >
                  <div className="font-semibold">{String(folder.name ?? "Folder")}</div>
                  <div className="text-xs text-[#706e6b]">
                    {data.quickTexts.filter((record) => record.folderId === folder.id).length} quick text item
                    {data.quickTexts.filter((record) => record.folderId === folder.id).length === 1 ? "" : "s"} -{" "}
                    {String(folder.sharing ?? "Private")}
                  </div>
                </button>
              ))}
            </div>
          )}
          {filteredRecords.length === 0 ? (
            <EmptyPanel
              title="Nothing to see here"
              body="There's nothing in your list yet. Try adding new quick text."
              action="New Quick Text"
              onAction={onCreate}
            />
          ) : (
            <QuickTextLibraryTable
              records={filteredRecords}
              foldersById={foldersById}
              favorites={favorites}
              showPreviewText={showPreviewText}
              showFolderColumn={showFolderColumn}
              onPreview={setPreviewRecord}
              onEdit={onEdit}
              onToggleFavorite={(id) => void toggleFavorite(id)}
              onDelete={onDelete}
            />
          )}
          {previewRecord && (
            <BaseDialog
              open
              title={String(previewRecord.name ?? "Quick Text Preview")}
              onClose={() => setPreviewRecord(null)}
              footer={
                <>
                  <Button
                    onClick={() => {
                      onEdit(previewRecord);
                      setPreviewRecord(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button onClick={() => setPreviewRecord(null)}>Close</Button>
                </>
              }
            >
              <div className="space-y-3 text-sm">
                <div className="whitespace-pre-wrap rounded border border-[#d8dde6] p-3">
                  {String(previewRecord.message ?? "")}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-[#706e6b]">Category</div>
                    <div>{String(previewRecord.category ?? "-")}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#706e6b]">Channels</div>
                    <div>{Array.isArray(previewRecord.channels) ? previewRecord.channels.join(", ") : "-"}</div>
                  </div>
                </div>
              </div>
            </BaseDialog>
          )}
        </div>
      </section>
    </div>
  );
}
export function QuickTextLibraryTable({
  records,
  foldersById,
  favorites,
  showPreviewText,
  showFolderColumn,
  onPreview,
  onEdit,
  onToggleFavorite,
  onDelete
}: {
  records: RecordData[];
  foldersById: Map<string, RecordData>;
  favorites: string[];
  showPreviewText: boolean;
  showFolderColumn: boolean;
  onPreview: (record: RecordData) => void;
  onEdit: (record: RecordData) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (record: RecordData) => void;
}) {
  return (
    <div className="overflow-auto rounded border border-[#d8dde6]">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#f3f3f3] text-xs text-[#514f4d]">
          <tr>
            <th className="border-b border-[#d8dde6] px-3 py-2">Quick Text Name</th>
            <th className="border-b border-[#d8dde6] px-3 py-2">Category</th>
            <th className="border-b border-[#d8dde6] px-3 py-2">Channel</th>
            {showFolderColumn && <th className="border-b border-[#d8dde6] px-3 py-2">Folder</th>}
            <th className="border-b border-[#d8dde6] px-3 py-2">Updated</th>
            <th className="border-b border-[#d8dde6] px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const id = requiredId(record);
            const favorite = favorites.includes(id);
            const folder = foldersById.get(String(record.folderId ?? ""));
            return (
              <tr key={id} className="border-t border-[#eef1f6] bg-white hover:bg-brand-50/40">
                <td className="px-3 py-2">
                  <button className="font-semibold text-brand-700 hover:underline" onClick={() => onPreview(record)}>
                    {String(record.name ?? "Quick Text")}
                  </button>
                  {showPreviewText && (
                    <div className="mt-1 max-w-xl truncate text-xs text-[#706e6b]">{String(record.message ?? "")}</div>
                  )}
                </td>
                <td className="px-3 py-2">{String(record.category ?? "-")}</td>
                <td className="px-3 py-2">{Array.isArray(record.channels) ? record.channels.join(", ") : "-"}</td>
                {showFolderColumn && <td className="px-3 py-2">{String(folder?.name ?? "Unfiled")}</td>}
                <td className="px-3 py-2">{record.updatedAt ? formatDateTime(String(record.updatedAt)) : "-"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                      className="rounded p-1 text-brand-700 hover:bg-white"
                      onClick={() => onToggleFavorite(id)}
                    >
                      <Bookmark size={14} fill={favorite ? "currentColor" : "none"} />
                    </button>
                    <button
                      aria-label="Preview quick text"
                      className="rounded p-1 text-[#706e6b] hover:bg-white hover:text-brand-700"
                      onClick={() => onPreview(record)}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      aria-label="Edit quick text"
                      className="rounded p-1 text-[#706e6b] hover:bg-white hover:text-brand-700"
                      onClick={() => onEdit(record)}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      aria-label="Delete quick text"
                      className="rounded p-1 text-[#706e6b] hover:bg-white hover:text-[#ba0517]"
                      onClick={() => onDelete(record)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
