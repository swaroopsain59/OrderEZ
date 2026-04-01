import { randomUUID } from "node:crypto";

const GST_RATE = 0.18;

export async function getMenu(pool) {
  const [rows] = await pool.query(
    `
      SELECT id, name, category, price, prep_time AS prepTime, tag_label AS tag, description, availability
      FROM menu_items
      WHERE availability = 1
      ORDER BY FIELD(category, 'Starters', 'Main Course', 'Drinks', 'Desserts'), name
    `,
  );
  return rows;
}

export async function createOrder(pool, payload) {
  const { tableNumber, items } = payload;

  if (!Number.isInteger(Number(tableNumber)) || !Array.isArray(items) || !items.length) {
    throw new Error("Invalid order payload.");
  }

  const ids = items.map((item) => item.id);
  const [menuRows] = await pool.query(
    `SELECT id, name, price FROM menu_items WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );

  const menuById = new Map(menuRows.map((row) => [row.id, row]));
  const orderItems = items.map((item) => {
    const menuItem = menuById.get(item.id);
    if (!menuItem) {
      throw new Error(`Menu item not found: ${item.id}`);
    }

    return {
      menuItemId: menuItem.id,
      itemName: menuItem.name,
      unitPrice: menuItem.price,
      quantity: Number(item.quantity),
    };
  });

  if (orderItems.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    throw new Error("Invalid item quantity.");
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const total = subtotal + gst;
  const orderId = randomUUID();

  await pool.query(
    `
      INSERT INTO orders (id, table_number, subtotal, gst, total)
      VALUES (?, ?, ?, ?, ?)
    `,
    [orderId, Number(tableNumber), subtotal, gst, total],
  );

  for (const item of orderItems) {
    await pool.query(
      `
        INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity)
        VALUES (?, ?, ?, ?, ?)
      `,
      [orderId, item.menuItemId, item.itemName, item.unitPrice, item.quantity],
    );
  }

  return getOrderById(pool, orderId);
}

export async function getLatestOrderForTable(pool, tableNumber) {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM orders
      WHERE table_number = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tableNumber],
  );

  if (!rows.length) {
    return null;
  }

  return getOrderById(pool, rows[0].id);
}

export async function getOrderById(pool, orderId) {
  const [orderRows] = await pool.query(
    `
      SELECT id, table_number AS tableNumber, status, subtotal, gst, total, created_at AS createdAt, updated_at AS updatedAt
      FROM orders
      WHERE id = ?
    `,
    [orderId],
  );

  if (!orderRows.length) {
    return null;
  }

  const [itemRows] = await pool.query(
    `
      SELECT menu_item_id AS id, item_name AS name, unit_price AS price, quantity
      FROM order_items
      WHERE order_id = ?
      ORDER BY id ASC
    `,
    [orderId],
  );

  return {
    ...orderRows[0],
    items: itemRows,
  };
}

export async function getAdminOrders(pool) {
  const [rows] = await pool.query(
    `
      SELECT id
      FROM orders
      ORDER BY created_at DESC
    `,
  );

  return Promise.all(rows.map((row) => getOrderById(pool, row.id)));
}

export async function updateOrderStatus(pool, orderId, status) {
  if (!["pending", "preparing", "served"].includes(status)) {
    throw new Error("Invalid order status.");
  }
  await pool.query(`UPDATE orders SET status = ? WHERE id = ?`, [status, orderId]);
  return getOrderById(pool, orderId);
}

export async function createWaiterCall(pool, tableNumber) {
  const id = randomUUID();
  await pool.query(`INSERT INTO waiter_calls (id, table_number) VALUES (?, ?)`, [id, tableNumber]);
  return getWaiterCalls(pool);
}

export async function getWaiterCalls(pool) {
  const [rows] = await pool.query(
    `
      SELECT id, table_number AS tableNumber, created_at AS createdAt
      FROM waiter_calls
      ORDER BY created_at DESC
    `,
  );
  return rows;
}

export async function clearWaiterCall(pool, callId) {
  await pool.query(`DELETE FROM waiter_calls WHERE id = ?`, [callId]);
  return getWaiterCalls(pool);
}

export async function getDashboardSummary(pool) {
  const [[salesRow]] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalOrders,
        COALESCE(SUM(total), 0) AS revenue,
        SUM(CASE WHEN status <> 'served' THEN 1 ELSE 0 END) AS openOrders
      FROM orders
    `,
  );
  const [[waiterRow]] = await pool.query(`SELECT COUNT(*) AS waiterCalls FROM waiter_calls`);
  return {
    totalOrders: salesRow.totalOrders,
    revenue: salesRow.revenue,
    openOrders: salesRow.openOrders,
    waiterCalls: waiterRow.waiterCalls,
  };
}
