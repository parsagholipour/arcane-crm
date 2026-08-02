import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type ScopedCrmData } from "@/lib/crm-types";
import { BaseDialog, Button } from "@/components/ui/crm-primitives";
import { Modal as CatalogModal } from "@/components/crm/catalog/primitives";
import { GenericRecordModal, ProductWizardModal } from "@/features/crm/record-editors";
import { ListEmailWizard } from "@/features/crm/list-email-editor";

const data = {
  user: { id: "user-1", name: "Primary User", alias: "primary" },
  users: [{ id: "user-1", name: "Primary User", alias: "primary" }],
  accounts: [],
  contacts: [],
  leads: [],
  opportunities: [],
  products: [],
  priceBooks: [],
  priceBookEntries: [],
  quickTextFolders: [],
  listEmails: []
} as unknown as ScopedCrmData;

describe("dialog Enter actions", () => {
  it("saves a standard record from a single-line field and still runs validation", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(false);
    render(<GenericRecordModal mode="new" object="Account" data={data} onClose={vi.fn()} onSave={onSave} />);

    const nameLabel = screen.getByText("Account Name", { exact: false }).closest("label");
    expect(nameLabel).not.toBeNull();
    const name = within(nameLabel as HTMLLabelElement).getByRole("textbox");
    await user.click(name);
    await user.keyboard("{Enter}");
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Complete this field.")).toBeInTheDocument();

    await user.type(name, "Entered Account");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Entered Account" }), false);
  });

  it("keeps textarea and handled lookup Enter behavior inside the field", async () => {
    const user = userEvent.setup();
    const onEnterAction = vi.fn();
    render(
      <BaseDialog
        open
        title="Keyboard boundaries"
        onClose={vi.fn()}
        onEnterAction={onEnterAction}
        footer={<Button>Save</Button>}
      >
        <textarea aria-label="Notes" />
        <input aria-label="Lookup" onKeyDown={(event) => event.preventDefault()} />
      </BaseDialog>
    );

    const notes = screen.getByRole("textbox", { name: "Notes" });
    await user.click(notes);
    await user.keyboard("{Enter}");
    expect(onEnterAction).not.toHaveBeenCalled();
    expect(notes).toHaveValue("\n");

    const lookup = screen.getByRole("textbox", { name: "Lookup" });
    fireEvent.keyDown(lookup, { key: "Enter" });
    expect(onEnterAction).not.toHaveBeenCalled();
  });

  it("suppresses repeated Enter actions while an async action is pending", async () => {
    let resolveAction: (() => void) | undefined;
    const onEnterAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        })
    );
    render(
      <CatalogModal title="Catalog editor" onClose={vi.fn()} onEnterAction={onEnterAction} footer={null}>
        <input aria-label="Catalog Name" />
      </CatalogModal>
    );

    const input = screen.getByRole("textbox", { name: "Catalog Name" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onEnterAction).toHaveBeenCalledOnce();

    resolveAction?.();
    await waitFor(() => expect(onEnterAction).toHaveBeenCalledOnce());
  });

  it("advances a wizard with Enter and saves list emails as drafts", async () => {
    const user = userEvent.setup();
    const wizard = render(
      <ProductWizardModal data={data} onClose={vi.fn()} onSave={vi.fn().mockResolvedValue(false)} />
    );

    await user.type(screen.getByRole("textbox", { name: /Product Name/ }), "Keyboard Product");
    await user.keyboard("{Enter}");
    expect(screen.getByText("New Price Book Entry - Current Stage")).toBeInTheDocument();
    wizard.unmount();

    const onSave = vi.fn().mockResolvedValue(false);
    const emailData = {
      ...data,
      leads: [{ id: "lead-1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" }]
    } as unknown as ScopedCrmData;
    render(
      <ListEmailWizard
        data={emailData}
        startingStep={2}
        initialValues={{
          subject: "Draft subject",
          body: "Draft body",
          recipients: ["lead:lead-1"]
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    fireEvent.keyDown(screen.getByRole("textbox", { name: /Subject/ }), { key: "Enter" });
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: "Draft" }));
  });
});
