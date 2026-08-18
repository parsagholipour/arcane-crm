import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useListViewController, type ListViewPageProps } from "@/features/crm/list-page-controller";
import { type ScopedCrmData } from "@/lib/crm-types";

const resourceMocks = vi.hoisted(() => ({
  saveListView: vi.fn()
}));

vi.mock("@/lib/api/resources", () => ({ resourceApi: resourceMocks }));

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
    onDeleteRecords: vi.fn(),
    onToast: vi.fn(),
    onListAction: vi.fn(),
    onSaveRecord: vi.fn().mockResolvedValue(true),
    onDataChange: vi.fn()
  };
}

beforeEach(() => {
  resourceMocks.saveListView.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useListViewController bulk delete", () => {
  it("stays unavailable until rows are selected, then deletes the selected records", () => {
    const props = accountListProps();
    const { result } = renderHook(() => useListViewController(props));
    expect(result.current.canDeleteSelected).toBe(false);

    act(() => result.current.setSelected([account.id]));
    expect(result.current.canDeleteSelected).toBe(true);

    act(() => result.current.deleteSelected());

    expect(props.onDeleteRecords).toHaveBeenCalledWith("Account", [account], expect.any(Function));
  });

  it("drops selected ids once their records leave the list", () => {
    const props = accountListProps();
    const { result, rerender } = renderHook((currentProps: ListViewPageProps) => useListViewController(currentProps), {
      initialProps: props
    });

    act(() => result.current.setSelected([account.id]));
    rerender({ ...props, records: [] });

    expect(result.current.selected).toEqual([]);
    expect(result.current.canDeleteSelected).toBe(false);
  });
});

describe("useListViewController pin toggle", () => {
  it("pins the current list view", async () => {
    resourceMocks.saveListView.mockResolvedValue({
      listViewPreferences: [{ object: "Account", viewName: "All Accounts", pinned: true }]
    });
    const props = accountListProps();
    const { result } = renderHook(() => useListViewController(props));

    await act(async () => {
      await result.current.pinListView();
    });

    expect(resourceMocks.saveListView).toHaveBeenCalledWith(expect.objectContaining({ viewName: "All Accounts" }), true);
    expect(props.onToast).toHaveBeenCalledWith({
      tone: "success",
      message: '"All Accounts" is now pinned.'
    });
  });

  it("unpins the current list view", async () => {
    resourceMocks.saveListView.mockResolvedValue({
      listViewPreferences: [{ object: "Account", viewName: "All Accounts", pinned: false }]
    });
    const props = accountListProps();
    props.data.listViewPreferences = [{ object: "Account", viewName: "All Accounts", pinned: true }];
    const { result } = renderHook(() => useListViewController(props));

    await act(async () => {
      await result.current.pinListView();
    });

    expect(resourceMocks.saveListView).toHaveBeenCalledWith(
      expect.objectContaining({ viewName: "All Accounts" }),
      false
    );
    expect(props.onToast).toHaveBeenCalledWith({
      tone: "success",
      message: '"All Accounts" is no longer pinned.'
    });
  });
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
