import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useListViewController, type ListViewPageProps } from "@/features/crm/list-page-controller";
import { type ScopedCrmData } from "@/lib/crm-types";

const account = { id: "account-1", name: "Acme" };

function accountListProps(): ListViewPageProps {
  return {
    object: "Account",
    data: {
      user: { id: "user-1", name: "User", alias: "user" },
      listViewPreferences: [],
      userPreferences: [],
      guidanceItems: [],
      guidanceStates: [],
      globalSearchRecents: []
    } as unknown as ScopedCrmData,
    records: [account],
    recordLabels: {},
    campaignMembers: {},
    initialQuery: "",
    initialListView: "",
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToast: vi.fn(),
    onListAction: vi.fn(),
    onSaveRecord: vi.fn().mockResolvedValue(true),
    onDataChange: vi.fn()
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useListViewController loading transitions", () => {
  it.each([
    ["search", (model: ReturnType<typeof useListViewController>) => model.setQuery("Acme")],
    ["list view", (model: ReturnType<typeof useListViewController>) => model.setListView("My Accounts")],
    ["page size", (model: ReturnType<typeof useListViewController>) => model.changePageSize(50)],
    ["server sorting", (model: ReturnType<typeof useListViewController>) => model.sortColumn("name")]
  ])("enters loading immediately after a %s change", (_name, change) => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useListViewController(accountListProps()));
    expect(result.current.listLoading).toBe(false);

    act(() => change(result.current));

    expect(result.current.listLoading).toBe(true);
  });
});
