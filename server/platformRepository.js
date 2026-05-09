import { createHash, randomUUID } from "node:crypto";

const GST_RATE = 0.18;
const INDIA_TIMEZONE = "Asia/Kolkata";

function normalizeMenuPayload(payload) {
  return {
    name: String(payload.name ?? "").trim(),
    category: String(payload.category ?? "").trim(),
    price: Number(payload.price),
    prepTime: String(payload.prepTime ?? "").trim(),
    tag: String(payload.tag ?? "").trim(),
    description: String(payload.description ?? "").trim(),
  };
}

function validateMenuPayload(menuItem) {
  if (!menuItem.name || !menuItem.category || !menuItem.prepTime || !menuItem.tag || !menuItem.description) {
    throw new Error("All menu fields are required.");
  }

  if (!Number.isFinite(menuItem.price) || menuItem.price <= 0) {
    throw new Error("Price must be a positive number.");
  }
}

function hashPasscode(passcode) {
  return createHash("sha256").update(passcode).digest("hex");
}

function getIndiaTodayRange() {
  const dateString = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const start = new Date(`${dateString}T00:00:00+05:30`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function getRestaurantRecord(pool, slug) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        name,
        slug,
        tagline,
        address_line AS addressLine,
        phone,
        hours_summary AS hoursSummary,
        admin_passcode_hash AS adminPasscodeHash
      FROM restaurants
      WHERE slug = ?
    `,
    [slug],
  );

  if (!rows.length) {
    throw new Error("Restaurant not found.");
  }

  return rows[0];
}

async function getTableRecord(pool, restaurantId, tableCode) {
  const [rows] = await pool.query(
    `
      SELECT id, table_code AS tableCode, qr_token AS qrToken, status
      FROM restaurant_tables
      WHERE restaurant_id = ? AND table_code = ?
    `,
    [restaurantId, tableCode],
  );

  if (!rows.length) {
    throw new Error("Table not found.");
  }

  return rows[0];
}

export async function getRestaurants(pool) {
  const [rows] = await pool.query(
    `
      SELECT
        r.name,
        r.slug,
        r.tagline,
        r.address_line AS addressLine,
        r.phone,
        r.hours_summary AS hoursSummary,
        COUNT(t.id) AS tableCount
      FROM restaurants r
      LEFT JOIN restaurant_tables t ON t.restaurant_id = r.id
      GROUP BY r.id, r.name, r.slug, r.tagline, r.address_line, r.phone, r.hours_summary
      ORDER BY r.name
    `,
  );

  return rows;
}

export async function getRestaurantPublicContext(pool, slug, tableCode) {
  const restaurant = await getRestaurantRecord(pool, slug);
  const table = await getTableRecord(pool, restaurant.id, tableCode);
  return {
    restaurant: {
      name: restaurant.name,
      slug: restaurant.slug,
      tagline: restaurant.tagline,
      addressLine: restaurant.addressLine,
      phone: restaurant.phone,
      hoursSummary: restaurant.hoursSummary,
    },
    table,
  };
}

export async function getRestaurantMenu(pool, slug) {
  const restaurant = await getRestaurantRecord(pool, slug);
  return getRestaurantMenuById(pool, restaurant.id, true);
}

export async function getRestaurantTables(pool, slug, clientOrigin) {
  const restaurant = await getRestaurantRecord(pool, slug);
  const [rows] = await pool.query(
    `
      SELECT table_code AS tableCode, qr_token AS qrToken, status
      FROM restaurant_tables
      WHERE restaurant_id = ?
      ORDER BY CAST(REPLACE(table_code, 'T', '') AS UNSIGNED)
    `,
    [restaurant.id],
  );

  return rows.map((row) => ({
    ...row,
    targetUrl: `${clientOrigin}/r/${restaurant.slug}/table/${row.tableCode}`,
    qrImageUrl: `/api/public/restaurants/${restaurant.slug}/tables/${row.tableCode}/qr`,
  }));
}

export async function getAdminMenu(pool, slug) {
  const restaurant = await getRestaurantRecord(pool, slug);
  return getRestaurantMenuById(pool, restaurant.id, false);
}

export async function verifyAdminPasscode(pool, slug, passcode) {
  const restaurant = await getRestaurantRecord(pool, slug);
  return {
    restaurant,
    isValid: restaurant.adminPasscodeHash === hashPasscode(passcode),
  };
}

export async function createRestaurant(pool, payload) {
  const slug = payload.slug.trim().toLowerCase();
  const restaurantId = slug;
  const passcodeHash = hashPasscode(payload.adminPasscode);
  const tableCount = Math.max(1, Math.min(Number(payload.tableCount ?? 10), 50));

  await pool.query(
    `
      INSERT INTO restaurants (id, name, slug, tagline, address_line, phone, hours_summary, admin_passcode_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      restaurantId,
      payload.name.trim(),
      slug,
      payload.tagline.trim(),
      payload.addressLine?.trim() ?? "Address to be updated",
      payload.phone?.trim() ?? "Phone to be updated",
      payload.hoursSummary?.trim() ?? "Hours to be updated",
      passcodeHash,
    ],
  );

  for (let tableNumber = 1; tableNumber <= tableCount; tableNumber += 1) {
    await pool.query(
      `
        INSERT INTO restaurant_tables (id, restaurant_id, table_code, qr_token)
        VALUES (?, ?, ?, ?)
      `,
      [`${restaurantId}-table-${tableNumber}`, restaurantId, `T${tableNumber}`, `${slug}-table-${tableNumber}`],
    );
  }

  const [templateItems] = await pool.query(
    `
      SELECT name, category, price, prep_time, tag_label, description
      FROM menu_items
      WHERE restaurant_id = 'gulab-ji-chai-bani-park'
    `,
  );

  for (const item of templateItems) {
    const menuId = `${restaurantId}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    await pool.query(
      `
        INSERT INTO menu_items (id, restaurant_id, name, category, price, prep_time, tag_label, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [menuId, restaurantId, item.name, item.category, item.price, item.prep_time, item.tag_label, item.description],
    );
  }

  return getRestaurantRecord(pool, slug);
}

export async function createMenuItem(pool, restaurantSlug, payload) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const menuItem = normalizeMenuPayload(payload);
  validateMenuPayload(menuItem);
  const menuId = `${restaurant.id}-${randomUUID()}`;

  await pool.query(
    `
      INSERT INTO menu_items (id, restaurant_id, name, category, price, prep_time, tag_label, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      menuId,
      restaurant.id,
      menuItem.name,
      menuItem.category,
      Math.round(menuItem.price),
      menuItem.prepTime,
      menuItem.tag,
      menuItem.description,
    ],
  );

  return getMenuItemById(pool, restaurant.id, menuId);
}

export async function updateMenuItem(pool, restaurantSlug, menuItemId, payload) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const menuItem = normalizeMenuPayload(payload);
  validateMenuPayload(menuItem);

  await pool.query(
    `
      UPDATE menu_items
      SET name = ?, category = ?, price = ?, prep_time = ?, tag_label = ?, description = ?
      WHERE id = ? AND restaurant_id = ?
    `,
    [
      menuItem.name,
      menuItem.category,
      Math.round(menuItem.price),
      menuItem.prepTime,
      menuItem.tag,
      menuItem.description,
      menuItemId,
      restaurant.id,
    ],
  );

  return getMenuItemById(pool, restaurant.id, menuItemId);
}

export async function deleteMenuItem(pool, restaurantSlug, menuItemId) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  await pool.query(
    `DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?`,
    [menuItemId, restaurant.id],
  );
  return getRestaurantMenuById(pool, restaurant.id, false);
}

export async function createOrder(pool, restaurantSlug, payload) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const table = await getTableRecord(pool, restaurant.id, payload.tableCode);

  if (!Array.isArray(payload.items) || !payload.items.length) {
    throw new Error("Order items are required.");
  }

  const itemIds = payload.items.map((item) => item.id);
  const [menuRows] = await pool.query(
    `SELECT id, name, price FROM menu_items WHERE restaurant_id = ? AND id IN (${itemIds.map(() => "?").join(",")})`,
    [restaurant.id, ...itemIds],
  );

  const menuById = new Map(menuRows.map((row) => [row.id, row]));
  const orderItems = payload.items.map((item) => {
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
      INSERT INTO orders (id, restaurant_id, table_id, subtotal, gst, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [orderId, restaurant.id, table.id, subtotal, gst, total],
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

  return getOrderById(pool, restaurant.id, orderId);
}

export async function getLatestOrderForTable(pool, restaurantSlug, tableCode) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const table = await getTableRecord(pool, restaurant.id, tableCode);
  const [rows] = await pool.query(
    `
      SELECT id
      FROM orders
      WHERE restaurant_id = ? AND table_id = ?
      ORDER BY
        CASE
          WHEN status IN ('pending', 'preparing', 'served') THEN 0
          ELSE 1
        END,
        updated_at DESC,
        created_at DESC
      LIMIT 1
    `,
    [restaurant.id, table.id],
  );

  if (!rows.length) {
    return null;
  }

  return getOrderById(pool, restaurant.id, rows[0].id);
}

export async function getOrderById(pool, restaurantId, orderId) {
  const [orderRows] = await pool.query(
    `
      SELECT
        o.id,
        t.table_code AS tableCode,
        o.status,
        o.subtotal,
        o.gst,
        o.total,
        o.created_at AS createdAt,
        o.updated_at AS updatedAt
      FROM orders o
      INNER JOIN restaurant_tables t ON t.id = o.table_id
      WHERE o.restaurant_id = ? AND o.id = ?
    `,
    [restaurantId, orderId],
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

export async function getAdminOrders(pool, restaurantSlug) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const { start, end } = getIndiaTodayRange();
  const [rows] = await pool.query(
    `
      SELECT id
      FROM orders
      WHERE restaurant_id = ? AND created_at >= ? AND created_at < ? AND status NOT IN ('paid', 'cancelled')
      ORDER BY created_at DESC
    `,
    [restaurant.id, start, end],
  );

  return Promise.all(rows.map((row) => getOrderById(pool, restaurant.id, row.id)));
}

export async function getAdminOrderHistory(pool, restaurantSlug) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const { start, end } = getIndiaTodayRange();
  const [rows] = await pool.query(
    `
      SELECT id
      FROM orders
      WHERE restaurant_id = ? AND (
        created_at < ?
        OR (created_at >= ? AND created_at < ? AND status IN ('paid', 'cancelled'))
      )
      ORDER BY created_at DESC
    `,
    [restaurant.id, start, start, end],
  );

  return Promise.all(rows.map((row) => getOrderById(pool, restaurant.id, row.id)));
}

export async function updateOrderStatus(pool, restaurantSlug, orderId, status) {
  if (!["pending", "preparing", "served", "paid", "cancelled"].includes(status)) {
    throw new Error("Invalid order status.");
  }

  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const [result] = await pool.query(
    `UPDATE orders SET status = ? WHERE id = ? AND restaurant_id = ?`,
    [status, orderId, restaurant.id],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  const updatedOrder = await getOrderById(pool, restaurant.id, orderId);
  if (!updatedOrder) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }
  return updatedOrder;
}

export async function createWaiterCall(pool, restaurantSlug, tableCode) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const table = await getTableRecord(pool, restaurant.id, tableCode);
  await pool.query(
    `INSERT INTO waiter_calls (id, restaurant_id, table_id) VALUES (?, ?, ?)`,
    [randomUUID(), restaurant.id, table.id],
  );
  return getWaiterCalls(pool, restaurantSlug);
}

export async function getWaiterCalls(pool, restaurantSlug) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const [rows] = await pool.query(
    `
      SELECT wc.id, t.table_code AS tableCode, wc.created_at AS createdAt
      FROM waiter_calls wc
      INNER JOIN restaurant_tables t ON t.id = wc.table_id
      WHERE wc.restaurant_id = ?
      ORDER BY wc.created_at DESC
    `,
    [restaurant.id],
  );
  return rows;
}

export async function clearWaiterCall(pool, restaurantSlug, callId) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  await pool.query(`DELETE FROM waiter_calls WHERE id = ? AND restaurant_id = ?`, [callId, restaurant.id]);
  return getWaiterCalls(pool, restaurantSlug);
}

export async function getDashboardSummary(pool, restaurantSlug) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const { start, end } = getIndiaTodayRange();
  const [[salesRow]] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalOrders,
        COALESCE(SUM(total), 0) AS revenue,
        SUM(CASE WHEN status NOT IN ('served', 'paid', 'cancelled') THEN 1 ELSE 0 END) AS openOrders
      FROM orders
      WHERE restaurant_id = ? AND created_at >= ? AND created_at < ?
    `,
    [restaurant.id, start, end],
  );
  const [[waiterRow]] = await pool.query(
    `SELECT COUNT(*) AS waiterCalls FROM waiter_calls WHERE restaurant_id = ?`,
    [restaurant.id],
  );
  return {
    totalOrders: salesRow.totalOrders,
    revenue: salesRow.revenue,
    openOrders: salesRow.openOrders,
    waiterCalls: waiterRow.waiterCalls,
  };
}

export async function cancelOrder(pool, restaurantSlug, orderId, tableCode) {
  const restaurant = await getRestaurantRecord(pool, restaurantSlug);
  const table = await getTableRecord(pool, restaurant.id, tableCode);
  const order = await getOrderById(pool, restaurant.id, orderId);

  if (!order || order.tableCode !== table.tableCode) {
    throw new Error("Order not found.");
  }

  if (order.status !== "pending") {
    throw new Error("Only pending orders can be cancelled.");
  }

  await pool.query(
    `UPDATE orders SET status = 'cancelled' WHERE id = ? AND restaurant_id = ?`,
    [orderId, restaurant.id],
  );

  return getOrderById(pool, restaurant.id, orderId);
}

async function getRestaurantMenuById(pool, restaurantId, onlyAvailable) {
  const [rows] = await pool.query(
    `
      SELECT id, name, category, price, prep_time AS prepTime, tag_label AS tag, description, availability
      FROM menu_items
      WHERE restaurant_id = ? ${onlyAvailable ? "AND availability = 1" : ""}
      ORDER BY FIELD(category, 'Gulabji Special', 'Chai', 'Shakes and Coolers', 'Rolls', 'Maggi & Chaat', 'Sandwiches', 'Mini Meals'), name
    `,
    [restaurantId],
  );
  return rows;
}

async function getMenuItemById(pool, restaurantId, menuItemId) {
  const [rows] = await pool.query(
    `
      SELECT id, name, category, price, prep_time AS prepTime, tag_label AS tag, description, availability
      FROM menu_items
      WHERE restaurant_id = ? AND id = ?
    `,
    [restaurantId, menuItemId],
  );

  if (!rows.length) {
    throw new Error("Menu item not found.");
  }

  return rows[0];
}
