export async function runCommerceScenarios(context, state) {
  const { assert, check, created, organizationId, postRecord, prisma, request, remember, tag } = context;
  let { account, contact, product, priceBook } = state;

  await check("commerce catalog, stores, promotions, orders, inventory, fulfillment, and UI", async () => {
    const catalogProduct = await postRecord(
      "Product2",
      {
        name: `${tag} Catalog Product`,
        productCode: `${tag}-catalog`,
        sku: `${tag}-catalog-sku`,
        active: true,
        description: `${tag} catalog item`,
        createPriceBookEntry: false
      },
      "products"
    );
    const entryCreated = await request(`/api/price-books/${priceBook.id}/entries`, {
      method: "POST",
      body: { productId: catalogProduct.id, listPrice: "20.00", currency: "USD", active: true },
      expected: [201]
    });
    remember("priceBookEntries", entryCreated.entry);
    assert(Number(entryCreated.entry.listPrice) === 20, "Price Book entry did not preserve its Decimal price");
    const entryUpdated = await request(`/api/price-books/${priceBook.id}/entries/${entryCreated.entry.id}`, {
      method: "PATCH",
      body: { listPrice: "22.50", active: true }
    });
    assert(Number(entryUpdated.entry.listPrice) === 22.5, "Price Book entry update did not persist");
    await request(`/api/price-books/${priceBook.id}/entries`, {
      method: "POST",
      body: { productId: catalogProduct.id, listPrice: 20, currency: "USD" },
      expected: [409]
    });
    await request(`/api/price-books/${priceBook.id}/entries/${entryCreated.entry.id}`, { method: "DELETE" });
    created.priceBookEntries = created.priceBookEntries.filter((id) => id !== entryCreated.entry.id);

    const storeCreated = await request("/api/commerce/stores", {
      method: "POST",
      body: {
        name: `${tag} Commerce Store`,
        slug: `${tag}-commerce`,
        currency: "USD",
        priceBookId: priceBook.id,
        description: `${tag} store`
      },
      expected: [201]
    });
    let store = remember("stores", storeCreated.store);
    storeCreated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      store.status === "Draft" && store.priceBookId === priceBook.id,
      "commerce store was not created as a Draft with its Price Book"
    );
    const storeUpdated = await request(`/api/commerce/stores/${store.id}`, {
      method: "PATCH",
      body: { description: `${tag} updated store` }
    });
    store = storeUpdated.store;
    assert(store.description.includes("updated"), "store edit did not persist");
    const activated = await request(`/api/commerce/stores/${store.id}/actions`, {
      method: "POST",
      body: { action: "activate" }
    });
    store = activated.store;
    activated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(store.status === "Active" && store.launchedAt, "store activation did not set lifecycle fields");

    const inventoryResult = await request(`/api/commerce/stores/${store.id}/inventory`, {
      method: "POST",
      body: { productId: product.id, quantityOnHand: "10.000", reorderPoint: "2.000" }
    });
    remember("inventoryItems", inventoryResult.inventoryItem);
    assert(Number(inventoryResult.inventoryItem.quantityOnHand) === 10, "inventory quantity was not stored");
    const negativeInventory = await request(`/api/commerce/stores/${store.id}/inventory`, {
      method: "POST",
      body: { productId: product.id, quantityOnHand: -1, reorderPoint: 0 },
      expected: [400]
    });
    assert(negativeInventory.error?.includes("negative"), "inventory accepted a negative quantity");

    const promotionResult = await request(`/api/commerce/stores/${store.id}/promotions`, {
      method: "POST",
      body: {
        name: `${tag} Ten Percent`,
        code: `${tag}-SAVE10`,
        type: "Percentage",
        value: "10",
        minimumOrderAmount: "50",
        maxRedemptions: 5,
        active: true
      },
      expected: [201]
    });
    const promotion = remember("commercePromotions", promotionResult.promotion);
    await request(`/api/commerce/stores/${store.id}/promotions`, {
      method: "POST",
      body: { name: "Duplicate", code: promotion.code, type: "Percentage", value: 10 },
      expected: [409]
    });

    const invalidLine = await request("/api/commerce/orders", {
      method: "POST",
      body: {
        storeId: store.id,
        accountId: account.id,
        lineItems: [{ productId: product.id, quantity: 0, unitPrice: 10 }]
      },
      expected: [400]
    });
    assert(invalidLine.error?.includes("quantity"), "commerce order accepted a zero quantity");

    const orderCreated = await request("/api/commerce/orders", {
      method: "POST",
      body: {
        storeId: store.id,
        accountId: account.id,
        contactId: contact.id,
        purchaseOrderNumber: `${tag}-ORDER-PO`,
        promotionCode: promotion.code,
        shippingTotal: "7.00",
        total: "1.00",
        notes: `${tag} commerce order`,
        lineItems: [
          {
            productId: product.id,
            description: `${tag} ordered product`,
            quantity: "2",
            unitPrice: "49.99",
            discountAmount: "5.00",
            taxRate: "10"
          }
        ]
      },
      expected: [201]
    });
    let order = remember("commerceOrders", orderCreated.order);
    order.lines?.forEach((line) => remember("commerceOrderLines", line));
    orderCreated.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      order.orderNumber.startsWith("ORD-") && order.status === "Draft",
      "order creation did not allocate a Draft order number"
    );
    assert(Number(order.subtotal) === 99.98, `order subtotal was ${order.subtotal}`);
    assert(
      Number(order.discountTotal) === 14.5 && Number(order.taxTotal) === 9.5 && Number(order.total) === 101.98,
      `server order totals were incorrect: ${order.total}`
    );

    const concurrentPayload = { storeId: store.id, accountId: account.id, lineItems: [] };
    const [concurrentA, concurrentB] = await Promise.all([
      request("/api/commerce/orders", { method: "POST", body: concurrentPayload, expected: [201] }),
      request("/api/commerce/orders", { method: "POST", body: concurrentPayload, expected: [201] })
    ]);
    remember("commerceOrders", concurrentA.order);
    remember("commerceOrders", concurrentB.order);
    assert(
      concurrentA.order.orderNumber !== concurrentB.order.orderNumber,
      "concurrent orders received colliding numbers"
    );
    await request(`/api/commerce/orders/${concurrentA.order.id}`, { method: "DELETE" });
    await request(`/api/commerce/orders/${concurrentB.order.id}`, { method: "DELETE" });
    created.commerceOrders = created.commerceOrders.filter(
      (id) => ![concurrentA.order.id, concurrentB.order.id].includes(id)
    );

    const confirmed = await request(`/api/commerce/orders/${order.id}/actions`, {
      method: "POST",
      body: { action: "confirm" }
    });
    order = confirmed.order;
    confirmed.notifications?.forEach((notification) => remember("notifications", notification));
    assert(order.status === "Confirmed" && order.confirmedAt, "order confirmation did not set lifecycle state");
    let inventory = await prisma.inventoryItem.findUnique({
      where: { organizationId_storeId_productId: { organizationId, storeId: store.id, productId: product.id } }
    });
    assert(Number(inventory?.quantityReserved) === 2, "order confirmation did not reserve inventory");
    await request(`/api/commerce/orders/${order.id}`, {
      method: "PATCH",
      body: { notes: "Forbidden" },
      expected: [409]
    });
    await request(`/api/commerce/orders/${order.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/commerce/orders/${order.id}/actions`, {
      method: "POST",
      body: { action: "fulfill", lines: [{ orderLineId: order.lines[0].id, quantity: 3 }] },
      expected: [400]
    });

    const partial = await request(`/api/commerce/orders/${order.id}/actions`, {
      method: "POST",
      body: {
        action: "fulfill",
        status: "Shipped",
        carrier: "External Carrier",
        trackingNumber: `${tag}-TRACK-1`,
        lines: [{ orderLineId: order.lines[0].id, quantity: 1 }]
      }
    });
    order = partial.order;
    remember("commerceFulfillments", partial.fulfillment);
    partial.fulfillment.lines?.forEach((line) => remember("commerceFulfillmentLines", line));
    partial.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      order.status === "Confirmed" && order.fulfillmentStatus === "Partially Fulfilled",
      "partial fulfillment status was incorrect"
    );
    inventory = await prisma.inventoryItem.findUnique({
      where: { organizationId_storeId_productId: { organizationId, storeId: store.id, productId: product.id } }
    });
    assert(
      Number(inventory?.quantityOnHand) === 9 && Number(inventory?.quantityReserved) === 1,
      "partial fulfillment did not update inventory"
    );

    const finalFulfillment = await request(`/api/commerce/orders/${order.id}/actions`, {
      method: "POST",
      body: { action: "fulfill", status: "Shipped", carrier: "External Carrier", trackingNumber: `${tag}-TRACK-2` }
    });
    order = finalFulfillment.order;
    remember("commerceFulfillments", finalFulfillment.fulfillment);
    finalFulfillment.fulfillment.lines?.forEach((line) => remember("commerceFulfillmentLines", line));
    finalFulfillment.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      order.status === "Fulfilled" && order.fulfillmentStatus === "Fulfilled" && order.fulfilledAt,
      "final fulfillment did not complete the order"
    );
    inventory = await prisma.inventoryItem.findUnique({
      where: { organizationId_storeId_productId: { organizationId, storeId: store.id, productId: product.id } }
    });
    assert(
      Number(inventory?.quantityOnHand) === 8 && Number(inventory?.quantityReserved) === 0,
      "final fulfillment did not consume and release inventory"
    );
    const delivered = await request(`/api/commerce/orders/${order.id}/actions`, {
      method: "POST",
      body: { action: "deliver", fulfillmentId: finalFulfillment.fulfillment.id }
    });
    order = delivered.order;
    delivered.notifications?.forEach((notification) => remember("notifications", notification));
    assert(
      order.fulfillments.some((item) => item.id === finalFulfillment.fulfillment.id && item.status === "Delivered"),
      "fulfillment delivery state did not persist"
    );
    await request(`/api/commerce/orders/${order.id}/actions`, {
      method: "POST",
      body: { action: "cancel" },
      expected: [409]
    });
    await request(`/api/commerce/stores/${store.id}/promotions/${promotion.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/records/Product2/${product.id}`, { method: "DELETE", expected: [409] });
    await request(`/api/records/Pricebook2/${priceBook.id}`, { method: "DELETE", expected: [409] });

    const orderList = await request("/api/commerce/orders");
    assert(
      orderList.orders.some((item) => item.id === order.id),
      "commerce order list omitted the created order"
    );
    const commerceHtml = await request("/lightning/app/commerce");
    for (const fragment of [
      "Sales Commerce Workspace",
      "New Store",
      "New Order",
      "Open Orders",
      "Active Promotions",
      order.orderNumber
    ])
      assert(commerceHtml.includes(fragment), `commerce workspace missing ${fragment}`);
    const productHtml = await request(`/lightning/r/Product2/${product.id}/view`);
    for (const fragment of [product.name, "Product Details", "Price Book Entries", "Inventory", "Order Usage"])
      assert(productHtml.includes(fragment), `Product detail missing ${fragment}`);
    const priceBookHtml = await request(`/lightning/r/Pricebook2/${priceBook.id}/view`);
    for (const fragment of [priceBook.name, "Price Book Details", "Add Product", "Connected Stores"])
      assert(priceBookHtml.includes(fragment), `Price Book detail missing ${fragment}`);
  });

  Object.assign(state, { account, contact, product, priceBook });
}
