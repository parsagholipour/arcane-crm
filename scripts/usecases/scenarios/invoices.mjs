export async function runInvoicesScenarios(context, state) {
  const {
    assert,
    check,
    created,
    currentUserId,
    organizationId,
    prisma,
    request,
    requestRaw,
    remember,
    rememberInvoiceResult,
    tag
  } = context;
  let { account, contact, opportunity, product, invoice } = state;

  await check("sales invoice validation, creation, numbering, and totals", async () => {
    const missingAccount = await request("/api/invoices", {
      method: "POST",
      body: { issueDate: "2026-07-01", dueDate: "2026-07-31", lineItems: [] },
      expected: [400]
    });
    assert(missingAccount.error?.includes("Account"), "invoice create did not require an Account");

    const invalidQuantity = await request("/api/invoices", {
      method: "POST",
      body: {
        accountId: account.id,
        issueDate: "2026-07-01",
        dueDate: "2026-07-31",
        lineItems: [{ description: "Invalid quantity", quantity: 0, unitPrice: 10 }]
      },
      expected: [400]
    });
    assert(invalidQuantity.error?.includes("quantity"), "invoice create accepted a zero quantity");

    const invalidDiscount = await request("/api/invoices", {
      method: "POST",
      body: {
        accountId: account.id,
        issueDate: "2026-07-01",
        dueDate: "2026-07-31",
        lineItems: [{ description: "Invalid discount", quantity: 1, unitPrice: 10, discountAmount: 11 }]
      },
      expected: [400]
    });
    assert(invalidDiscount.error?.includes("discount"), "invoice create accepted a discount above the line subtotal");

    const createdInvoice = await request("/api/invoices", {
      method: "POST",
      body: {
        accountId: account.id,
        opportunityId: opportunity.id,
        issueDate: "2026-07-01",
        dueDate: "2026-07-31",
        currency: "USD",
        purchaseOrderNumber: `${tag}-PO`,
        billingName: `${tag} Billing`,
        notes: `${tag} invoice notes`,
        terms: "Net 30",
        lineItems: [
          {
            productId: product.id,
            description: `${tag} Product line`,
            quantity: "2",
            unitPrice: "49.99",
            discountAmount: "9.98",
            taxRate: "10"
          },
          { description: `${tag} Service line`, quantity: "1.5", unitPrice: "20.00", discountAmount: "0", taxRate: "5" }
        ]
      },
      expected: [201]
    });
    invoice = rememberInvoiceResult(createdInvoice);
    assert(invoice?.invoiceNumber?.startsWith("INV-"), "invoice create did not allocate an invoice number");
    assert(invoice?.status === "Draft", "invoice create did not create a Draft");
    assert(invoice?.lineItems?.length === 2, "invoice create did not persist multiple line items");
    assert(Number(invoice.subtotal) === 129.98, `invoice subtotal was ${invoice.subtotal}, expected 129.98`);
    assert(
      Number(invoice.discountTotal) === 9.98,
      `invoice discount total was ${invoice.discountTotal}, expected 9.98`
    );
    assert(Number(invoice.taxTotal) === 10.5, `invoice tax total was ${invoice.taxTotal}, expected 10.50`);
    assert(
      Number(invoice.total) === 130.5 && Number(invoice.balanceDue) === 130.5,
      "invoice final totals were not calculated on the server"
    );

    const concurrentPayload = {
      accountId: account.id,
      issueDate: "2026-07-01",
      dueDate: "2026-07-31",
      currency: "USD",
      lineItems: [{ description: `${tag} Concurrent`, quantity: 1, unitPrice: 1, discountAmount: 0, taxRate: 0 }]
    };
    const [firstConcurrent, secondConcurrent] = await Promise.all([
      request("/api/invoices", { method: "POST", body: concurrentPayload, expected: [201] }),
      request("/api/invoices", { method: "POST", body: concurrentPayload, expected: [201] })
    ]);
    const firstNumber = rememberInvoiceResult(firstConcurrent)?.invoiceNumber;
    const secondNumber = rememberInvoiceResult(secondConcurrent)?.invoiceNumber;
    assert(
      firstNumber && secondNumber && firstNumber !== secondNumber,
      "concurrent invoice creates returned colliding numbers"
    );
    const uniqueCount = await prisma.invoice.count({
      where: { organizationId, invoiceNumber: { in: [firstNumber, secondNumber] } }
    });
    assert(uniqueCount === 2, "concurrent invoice numbers were not unique in the database");
  });

  await check("sales invoice draft editing and lifecycle validation", async () => {
    const updated = await request(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      body: { notes: `${tag} edited invoice notes`, terms: "Due on receipt" }
    });
    rememberInvoiceResult(updated);
    invoice = updated.invoice;
    assert(
      invoice.notes === `${tag} edited invoice notes` && invoice.lineItems.length === 2,
      "draft edit did not retain the invoice aggregate"
    );
    assert(Number(invoice.total) === 130.5, "draft edit trusted or changed totals unexpectedly");

    const emptyDraftResult = await request("/api/invoices", {
      method: "POST",
      body: { accountId: account.id, issueDate: "2026-07-01", dueDate: "2026-07-31", lineItems: [] },
      expected: [201]
    });
    const emptyDraft = rememberInvoiceResult(emptyDraftResult);
    const rejectedSend = await request(`/api/invoices/${emptyDraft.id}/actions`, {
      method: "POST",
      body: { action: "mark-sent" },
      expected: [400]
    });
    assert(rejectedSend.error?.includes("line item"), "invoice without line items could be marked Sent");
    await request(`/api/invoices/${emptyDraft.id}`, { method: "DELETE" });
    created.invoices = created.invoices.filter((id) => id !== emptyDraft.id);

    const draftDetailHtml = await request(`/lightning/r/Invoice/${invoice.id}/view`);
    assert(draftDetailHtml.includes("Mark as Sent"), "Draft invoice detail did not expose Mark as Sent");
    const markedSent = await request(`/api/invoices/${invoice.id}/actions`, {
      method: "POST",
      body: { action: "mark-sent" }
    });
    invoice = rememberInvoiceResult(markedSent);
    assert(invoice.status === "Sent" && invoice.sentAt, "Mark as Sent did not update the lifecycle timestamp");
    await request(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      body: { notes: "Forbidden edit" },
      expected: [409]
    });
    await request(`/api/invoices/${invoice.id}/actions`, {
      method: "POST",
      body: { action: "send", recipientEmail: contact.email },
      expected: [409]
    });
  });

  await check("sales invoice partial and final payments", async () => {
    const zeroPayment = await request(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      body: { amount: 0, paymentDate: "2026-07-10", paymentMethod: "Bank Transfer" },
      expected: [400]
    });
    assert(zeroPayment.error?.includes("greater than zero"), "invoice accepted a zero payment");

    const partial = await request(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      body: {
        amount: "30.00",
        paymentDate: "2026-07-10",
        paymentMethod: "Bank Transfer",
        referenceNumber: `${tag}-PAY-1`,
        notes: "External transfer"
      },
      expected: [201]
    });
    rememberInvoiceResult(partial);
    invoice = partial.invoice;
    assert(invoice.status === "Partially Paid", "partial payment did not set Partially Paid status");
    assert(
      Number(invoice.amountPaid) === 30 && Number(invoice.balanceDue) === 100.5,
      "partial payment totals were not recalculated"
    );
    assert(invoice.payments.length === 1, "partial payment was not added to payment history");

    const overpayment = await request(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      body: { amount: "100.51", paymentDate: "2026-07-11", paymentMethod: "Check" },
      expected: [400]
    });
    assert(overpayment.error?.includes("outstanding balance"), "invoice accepted an overpayment");

    const finalPayment = await request(`/api/invoices/${invoice.id}/payments`, {
      method: "POST",
      body: { amount: "100.50", paymentDate: "2026-07-11", paymentMethod: "Check", referenceNumber: `${tag}-PAY-2` },
      expected: [201]
    });
    rememberInvoiceResult(finalPayment);
    invoice = finalPayment.invoice;
    assert(invoice.status === "Paid" && invoice.paidAt, "final payment did not mark the invoice Paid");
    assert(
      Number(invoice.amountPaid) === 130.5 && Number(invoice.balanceDue) === 0,
      "final payment totals were not recalculated"
    );
    await request(`/api/invoices/${invoice.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/invoices/${invoice.id}/actions`, { method: "POST", body: { action: "void" }, expected: [409] });
  });

  await check("sales invoice overdue, void, and draft deletion restrictions", async () => {
    const overdueCreated = await request("/api/invoices", {
      method: "POST",
      body: {
        accountId: account.id,
        issueDate: "2026-01-01",
        dueDate: "2026-01-02",
        lineItems: [{ description: `${tag} Overdue`, quantity: 1, unitPrice: 25, taxRate: 0 }]
      },
      expected: [201]
    });
    let overdueInvoice = rememberInvoiceResult(overdueCreated);
    rememberInvoiceResult(
      await request(`/api/invoices/${overdueInvoice.id}/actions`, { method: "POST", body: { action: "mark-sent" } })
    );
    const overdueRead = await request(`/api/invoices/${overdueInvoice.id}`);
    overdueInvoice = rememberInvoiceResult(overdueRead);
    assert(overdueInvoice.status === "Overdue", "past-due Sent invoice did not display as Overdue");

    const voidCreated = await request("/api/invoices", {
      method: "POST",
      body: {
        accountId: account.id,
        issueDate: "2026-07-01",
        dueDate: "2026-07-31",
        lineItems: [{ description: `${tag} Void`, quantity: 1, unitPrice: 10, taxRate: 0 }]
      },
      expected: [201]
    });
    let voidInvoice = rememberInvoiceResult(voidCreated);
    rememberInvoiceResult(
      await request(`/api/invoices/${voidInvoice.id}/actions`, { method: "POST", body: { action: "mark-sent" } })
    );
    const voided = await request(`/api/invoices/${voidInvoice.id}/actions`, {
      method: "POST",
      body: { action: "void" }
    });
    rememberInvoiceResult(voided);
    voidInvoice = voided.invoice;
    assert(voidInvoice.status === "Void" && voidInvoice.voidedAt, "void action did not set Void status");
    await request(`/api/invoices/${voidInvoice.id}/payments`, {
      method: "POST",
      body: { amount: 1, paymentDate: "2026-07-12", paymentMethod: "Cash" },
      expected: [409]
    });
    await request(`/api/invoices/${voidInvoice.id}`, { method: "DELETE", expected: [409] });

    const deleteCreated = await request("/api/invoices", {
      method: "POST",
      body: { accountId: account.id, lineItems: [] },
      expected: [201]
    });
    const deleteDraft = rememberInvoiceResult(deleteCreated);
    await request(`/api/invoices/${deleteDraft.id}`, { method: "DELETE" });
    assert(
      !(await prisma.invoice.findUnique({ where: { id: deleteDraft.id } })),
      "Draft invoice deletion did not remove the invoice"
    );
    created.invoices = created.invoices.filter((id) => id !== deleteDraft.id);
  });

  await check("sales invoice list, detail, notifications, and PDF render", async () => {
    const list = await request("/api/invoices");
    assert(
      list.invoices.some((item) => item.id === invoice.id),
      "invoice list API omitted the created invoice"
    );
    const listHtml = await request("/lightning/o/Invoice/list");
    for (const fragment of [
      "Invoices",
      "New Invoice",
      "Invoice Number",
      "Amount Paid",
      "Balance Due",
      invoice.invoiceNumber
    ]) {
      assert(listHtml.includes(fragment), `invoice list missing ${fragment}`);
    }
    const detailHtml = await request(`/lightning/r/Invoice/${invoice.id}/view`);
    for (const fragment of [
      invoice.invoiceNumber,
      "Invoice Details",
      "Line Items",
      "Payment History",
      "Download PDF",
      "Record Information"
    ]) {
      assert(detailHtml.includes(fragment), `invoice detail missing ${fragment}`);
    }

    const pdfResponse = await requestRaw(`/api/invoices/${invoice.id}/pdf`);
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    assert(
      pdfResponse.headers.get("content-type")?.includes("application/pdf"),
      "invoice PDF endpoint did not return application/pdf"
    );
    assert(
      pdfResponse.headers.get("content-disposition")?.includes(`${invoice.invoiceNumber}.pdf`),
      "invoice PDF filename was incorrect"
    );
    assert(
      new TextDecoder().decode(pdfBytes.slice(0, 5)) === "%PDF-",
      "invoice PDF response was not a valid PDF document"
    );
    assert(pdfBytes.length > 1000, "invoice PDF response was unexpectedly small");

    const notifications = await prisma.notification.findMany({
      where: { organizationId, userId: currentUserId, href: `/lightning/r/Invoice/${invoice.id}/view` }
    });
    assert(
      notifications.some((item) => item.title === "Invoice created"),
      "invoice creation notification was not created"
    );
    assert(
      notifications.some((item) => item.title === "Invoice sent"),
      "invoice sent notification was not created"
    );
    assert(
      notifications.some((item) => item.title === "Invoice payment recorded"),
      "invoice payment notification was not created"
    );
    assert(
      notifications.some((item) => item.title === "Invoice paid"),
      "invoice paid notification was not created"
    );
    notifications.forEach((notification) => remember("notifications", notification));
  });

  Object.assign(state, { account, contact, opportunity, product, invoice });
}
