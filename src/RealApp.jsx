import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { adminFetch, apiFetch } from "./api";
import AdminLogin from "./components/AdminLogin";
import AdminWorkspace from "./components/AdminWorkspace";
import GuestView from "./components/GuestView";
import RestaurantPicker from "./components/RestaurantPicker";
import {
  calculateOrderTotals,
  CATEGORY_ORDER,
  currency,
  getStatusTone,
  STATUS_LABELS,
} from "./format";
import { parseRoute } from "./routes";

const ADMIN_SESSION_KEY = "orderez-admin-token-v1";
const EMPTY_FILTERS = { category: "All", query: "" };

function toDisplayMessage(error, fallbackMessage) {
  const message = error?.message?.trim();
  if (!message || message.includes("Cannot read properties")) {
    return fallbackMessage;
  }
  return message;
}

function getSocketServerUrl() {
  if (!import.meta.env.DEV) {
    return undefined;
  }

  return `http://${window.location.hostname}:4000`;
}

function RealApp() {
  const [route] = useState(parseRoute);
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantInfo, setRestaurantInfo] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [adminMenuItems, setAdminMenuItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activeOrder, setActiveOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [historyOrders, setHistoryOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [waiterCalls, setWaiterCalls] = useState([]);
  const [tables, setTables] = useState([]);
  const [summary, setSummary] = useState({ openOrders: 0, revenue: 0, totalOrders: 0, waiterCalls: 0 });
  const [billSplit, setBillSplit] = useState(2);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminToken, setAdminToken] = useState(() => window.sessionStorage.getItem(ADMIN_SESSION_KEY) ?? "");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const deferredQuery = useDeferredValue(filters.query);
  const activeView = route.kind === "admin" || route.kind === "admin-directory" ? "admin" : "guest";
  const restaurantSlug = route.restaurantSlug;
  const tableCode = route.tableCode;
  const isGuestRoute = route.kind === "guest";
  const isAdminWorkspaceRoute = route.kind === "admin" && Boolean(adminToken);
  const isImmersiveRoute = isGuestRoute || isAdminWorkspaceRoute;

  const categories = useMemo(() => ["All", ...CATEGORY_ORDER], []);
  const cartTotals = useMemo(() => calculateOrderTotals(cart), [cart]);
  const splitAmount = cartTotals.total / billSplit;
  const selectedOrder = useMemo(
    () =>
      orders.find((order) => order.id === selectedOrderId) ??
      historyOrders.find((order) => order.id === selectedOrderId) ??
      orders[0] ??
      null,
    [historyOrders, orders, selectedOrderId],
  );

  const filteredMenuItems = useMemo(() => {
    const query = deferredQuery.toLowerCase().trim();
    return menuItems.filter((item) => {
      const matchesCategory = filters.category === "All" || item.category === filters.category;
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tag.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [deferredQuery, filters.category, menuItems]);

  useEffect(() => {
    if (!errorMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setErrorMessage("");
    }, 4000);

    return () => window.clearTimeout(timeoutId);
  }, [errorMessage]);

  useEffect(() => {
    const socket = io(getSocketServerUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("order:updated", (payload) => {
      if (
        activeView === "guest" &&
        payload.restaurantSlug === restaurantSlug &&
        payload.tableCode === tableCode
      ) {
        setActiveOrder(payload.latestOrder);
      }

      if (activeView === "admin" && adminToken && payload.restaurantSlug === restaurantSlug) {
        void loadAdminSurface(adminToken);
      }
    });

    socket.on("waiter-calls:updated", (payload) => {
      if (activeView === "admin" && adminToken && payload.restaurantSlug === restaurantSlug) {
        setWaiterCalls(payload.waiterCalls);
      }
    });

    socket.on("dashboard:updated", (payload) => {
      if (activeView === "admin" && adminToken && payload.restaurantSlug === restaurantSlug) {
        setSummary(payload.summary);
      }
    });

    return () => socket.disconnect();
  }, [activeView, adminToken, restaurantSlug, tableCode]);

  useEffect(() => {
    void hydrate();
  }, [activeView, adminToken, restaurantSlug, tableCode, route.kind]);

  async function hydrate() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const restaurantList = await apiFetch("/api/restaurants");
      setRestaurants(restaurantList);

      if (route.kind === "directory" || route.kind === "admin-directory") {
        setMenuItems([]);
        setRestaurantInfo(null);
        setActiveOrder(null);
        setOrders([]);
        setHistoryOrders([]);
        setWaiterCalls([]);
        setTables([]);
        setAdminMenuItems([]);
      } else if (route.kind === "guest") {
        const [context, menu, latestOrder] = await Promise.all([
          apiFetch(`/api/public/restaurants/${restaurantSlug}/context/${tableCode}`),
          apiFetch(`/api/public/restaurants/${restaurantSlug}/menu`),
          apiFetch(`/api/public/restaurants/${restaurantSlug}/orders/latest/${tableCode}`),
        ]);
        setRestaurantInfo(context);
        setMenuItems(menu);
        setActiveOrder(latestOrder);
      } else if (adminToken) {
        const context = await apiFetch(`/api/public/restaurants/${restaurantSlug}/context/T1`);
        setRestaurantInfo(context);
        await loadAdminSurface(adminToken);
      }
    } catch (error) {
      if (activeView === "admin" && adminToken) {
        window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAdminToken("");
      }
      setErrorMessage(toDisplayMessage(error, "Couldn't load the latest restaurant data."));
    } finally {
      setIsLoading(false);
    }
  }

  async function loadAdminSurface(token) {
    const [adminOrders, historyOrderList, adminCalls, dashboardSummary, restaurantTables, adminMenu] = await Promise.all([
      adminFetch(`/api/admin/restaurants/${restaurantSlug}/orders`, token),
      adminFetch(`/api/admin/restaurants/${restaurantSlug}/orders/history`, token),
      adminFetch(`/api/admin/restaurants/${restaurantSlug}/waiter-calls`, token),
      adminFetch(`/api/admin/restaurants/${restaurantSlug}/summary`, token),
      adminFetch(`/api/admin/restaurants/${restaurantSlug}/tables`, token),
      adminFetch(`/api/admin/restaurants/${restaurantSlug}/menu`, token),
    ]);

    const validOrders = adminOrders.filter(Boolean);
    const validHistoryOrders = historyOrderList.filter(Boolean);
    setOrders(validOrders);
    setHistoryOrders(validHistoryOrders);
    setWaiterCalls(adminCalls);
    setSummary(dashboardSummary);
    setTables(restaurantTables);
    setAdminMenuItems(adminMenu);
    setErrorMessage("");
    setSelectedOrderId((currentSelectedOrderId) =>
      [...validOrders, ...validHistoryOrders].some((order) => order.id === currentSelectedOrderId)
        ? currentSelectedOrderId
        : validOrders[0]?.id ?? null,
    );
  }

  function updateFilter(name, value) {
    startTransition(() => {
      setFilters((current) => ({ ...current, [name]: value }));
    });
  }

  function addToCart(item, quantity = 1) {
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    setCart((currentCart) => {
      const existingItem = currentCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + safeQuantity } : cartItem,
        );
      }

      return [...currentCart, { ...item, quantity: safeQuantity }];
    });
  }

  function changeQuantity(itemId, nextQuantity) {
    if (nextQuantity <= 0) {
      setCart((currentCart) => currentCart.filter((item) => item.id !== itemId));
      return;
    }

    setCart((currentCart) =>
      currentCart.map((item) => (item.id === itemId ? { ...item, quantity: nextQuantity } : item)),
    );
  }

  async function placeOrder() {
    if (!cart.length) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const order = await apiFetch(`/api/public/restaurants/${restaurantSlug}/orders`, {
        method: "POST",
        body: JSON.stringify({
          tableCode,
          items: cart.map((item) => ({ id: item.id, quantity: item.quantity })),
        }),
      });

      setActiveOrder(order);
      setCart([]);
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't place the order. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestWaiter() {
    setErrorMessage("");

    try {
      await apiFetch(`/api/public/restaurants/${restaurantSlug}/waiter-calls`, {
        method: "POST",
        body: JSON.stringify({ tableCode }),
      });
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't send the waiter request."));
    }
  }

  async function cancelOrder() {
    if (!activeOrder || activeOrder.status !== "pending") return;
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const updatedOrder = await apiFetch(
        `/api/public/restaurants/${restaurantSlug}/orders/${activeOrder.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ tableCode }),
        },
      );
      setActiveOrder(updatedOrder);
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't cancel the order."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loginAdmin(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await apiFetch(`/api/admin/restaurants/${restaurantSlug}/login`, {
        method: "POST",
        body: JSON.stringify({ passcode: adminPasscode }),
      });

      window.sessionStorage.setItem(ADMIN_SESSION_KEY, response.token);
      setAdminToken(response.token);
      await loadAdminSurface(response.token);
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't unlock the admin dashboard."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateOrderStatus(orderId, status) {
    const previousOrders = orders;
    const previousHistoryOrders = historyOrders;
    try {
      setUpdatingOrderId(orderId);
      setErrorMessage("");
      setOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === orderId ? { ...order, status } : order)),
      );
      setHistoryOrders((currentOrders) =>
        currentOrders.map((order) => (order.id === orderId ? { ...order, status } : order)),
      );
      await adminFetch(
        `/api/admin/restaurants/${restaurantSlug}/orders/${orderId}/status`,
        adminToken,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
          timeoutMs: 8000,
        },
      );
      setSelectedOrderId(orderId);
      setErrorMessage("");
    } catch (error) {
      if (error?.status === 401) {
        window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
        setAdminToken("");
        setErrorMessage("Session expired. Please log in again.");
        return;
      }
      setOrders(previousOrders);
      setHistoryOrders(previousHistoryOrders);
      setErrorMessage(toDisplayMessage(error, "Couldn't update the order status. Please try again."));
    } finally {
      setUpdatingOrderId("");
    }

    try {
      await loadAdminSurface(adminToken);
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't refresh the admin queue. Please try again."));
    }
  }

  async function clearWaiterCall(callId) {
    try {
      await adminFetch(`/api/admin/restaurants/${restaurantSlug}/waiter-calls/${callId}`, adminToken, { method: "DELETE" });
      setWaiterCalls((currentCalls) => currentCalls.filter((call) => call.id !== callId));
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't clear the waiter call."));
    }
  }

  async function createAdminMenuItem(payload) {
    try {
      const createdItem = await adminFetch(
        `/api/admin/restaurants/${restaurantSlug}/menu`,
        adminToken,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setAdminMenuItems((currentItems) => [...currentItems, createdItem]);
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't add the menu item."));
      throw error;
    }
  }

  async function updateAdminMenuItem(menuItemId, payload) {
    try {
      const updatedItem = await adminFetch(
        `/api/admin/restaurants/${restaurantSlug}/menu/${menuItemId}`,
        adminToken,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
      );
      setAdminMenuItems((currentItems) =>
        currentItems.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
      );
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't save the menu item."));
      throw error;
    }
  }

  async function deleteAdminMenuItem(menuItemId) {
    try {
      const remainingItems = await adminFetch(
        `/api/admin/restaurants/${restaurantSlug}/menu/${menuItemId}`,
        adminToken,
        {
          method: "DELETE",
        },
      );
      setAdminMenuItems(remainingItems);
    } catch (error) {
      setErrorMessage(toDisplayMessage(error, "Couldn't delete the menu item."));
      throw error;
    }
  }

  return (
    <div className="app-shell">
      {!isImmersiveRoute ? (
        <header className="topbar">
          <div>
            <p className="eyebrow">QR Dining OS</p>
            <h1>OrderEZ</h1>
          </div>
          <div className="topbar-actions">
            {route.kind === "admin" ? (
              <>
                <div className="table-chip">{restaurantSlug} admin</div>
                <a className="ghost-link" href={`/r/${restaurantSlug}/table/T1`}>Customer menu</a>
              </>
            ) : (
              <a className="ghost-link" href="/">All restaurants</a>
            )}
          </div>
        </header>
      ) : null}

      <main>
        {!isImmersiveRoute ? (
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">
                {route.kind === "admin"
                  ? `${restaurantInfo?.restaurant?.name ?? restaurantSlug ?? "Restaurant"} admin desk`
                  : "Multi-tenant restaurant platform"}
              </p>
              <h2>Scan, order, track, and settle the bill without waiting for the menu.</h2>
              <p className="hero-text">
                {route.kind === "admin"
                  ? "Each restaurant gets its own isolated admin dashboard, QR tables, orders, waiter calls, and live kitchen status updates."
                  : "OrderEZ now supports many restaurants on one platform with separate slugs, tables, QR targets, and MySQL-backed data isolation."}
              </p>
              <div className="hero-actions">
                {route.kind === "admin" ? (
                  <>
                    <button className="primary-button" onClick={() => window.scrollTo({ top: 560, behavior: "smooth" })}>Open queue</button>
                    <a className="secondary-link" href={`/r/${restaurantSlug}/table/T1`}>View customer flow</a>
                  </>
                ) : (
                  <>
                    <a className="primary-button" href="/r/gulab-ji-chai-bani-park/table/T1">Open demo QR flow</a>
                    <a className="secondary-link" href="/admin/gulab-ji-chai-bani-park">Open demo admin</a>
                  </>
                )}
              </div>
              {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
            </div>

            <div className="hero-panel">
              <div className="stat-strip">
                {route.kind === "admin" ? (
                  <>
                    <span>{summary.totalOrders} orders</span>
                    <span>{summary.openOrders} open</span>
                    <span>{currency.format(summary.revenue)} revenue</span>
                  </>
                ) : (
                  <>
                    <span>{restaurants.length} restaurants</span>
                    <span>Per-table QR routing</span>
                    <span>Tenant-isolated orders</span>
                  </>
                )}
              </div>
              <div className="hero-visual">
                <div className="orb orb-one" />
                <div className="orb orb-two" />
                <div className="visual-card">
                  <p>{route.kind === "admin" ? "Operations snapshot" : "Platform snapshot"}</p>
                  <strong>{route.kind === "admin" ? `${summary.openOrders} active` : `${restaurants.length} clients`}</strong>
                  <span className={`status-pill ${getStatusTone(activeOrder?.status ?? "pending")}`}>
                    {route.kind === "admin" ? `${summary.waiterCalls} waiter calls` : "QR ready"}
                  </span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {isLoading ? <section className="loading-panel">Loading live restaurant data...</section> : null}

        {!isLoading && route.kind === "directory" ? (
          <RestaurantPicker
            restaurants={restaurants}
            title="Pick a restaurant QR experience"
            description="Each restaurant gets its own slug, tables, QR targets, menu, and isolated orders."
          />
        ) : null}

        {!isLoading && route.kind === "admin-directory" ? (
          <RestaurantPicker
            adminMode
            restaurants={restaurants}
            title="Choose a restaurant admin workspace"
            description="Every client has a separate admin URL, passcode, orders queue, waiter calls, and QR table list."
          />
        ) : null}

        {!isLoading && route.kind === "guest" ? (
          <GuestView
            activeOrder={activeOrder}
            addToCart={addToCart}
            billSplit={billSplit}
            cart={cart}
            cartTotals={cartTotals}
            categories={categories}
            changeQuantity={changeQuantity}
            filteredMenuItems={filteredMenuItems}
            filters={filters}
            isSubmitting={isSubmitting}
            placeOrder={placeOrder}
            restaurant={restaurantInfo?.restaurant}
            requestWaiter={requestWaiter}
            cancelOrder={cancelOrder}
            setBillSplit={setBillSplit}
            splitAmount={splitAmount}
            tableCode={tableCode}
            updateFilter={updateFilter}
            errorMessage={errorMessage}
          />
        ) : null}

        {!isLoading && route.kind === "admin" && !adminToken ? (
          <AdminLogin
            adminPasscode={adminPasscode}
            errorMessage={errorMessage}
            isSubmitting={isSubmitting}
            onChangePasscode={setAdminPasscode}
            onUnlock={loginAdmin}
          />
        ) : null}

        {!isLoading && route.kind === "admin" && adminToken ? (
          <AdminWorkspace
            menuItems={adminMenuItems}
            onCreateMenuItem={createAdminMenuItem}
            onClearWaiterCall={clearWaiterCall}
            onDeleteMenuItem={deleteAdminMenuItem}
            onSelectOrder={setSelectedOrderId}
            onUpdateMenuItem={updateAdminMenuItem}
            onUpdateOrderStatus={updateOrderStatus}
            orders={orders}
            historyOrders={historyOrders}
            restaurant={restaurantInfo?.restaurant}
            restaurantSlug={restaurantSlug}
            selectedOrder={selectedOrder}
            summary={summary}
            tables={tables}
            updatingOrderId={updatingOrderId}
            waiterCalls={waiterCalls}
          />
        ) : null}
      </main>
    </div>
  );
}

export default RealApp;
