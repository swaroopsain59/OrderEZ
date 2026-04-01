import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";

const GST_RATE = 0.18;
const STORAGE_KEY = "orderez-state-v1";
const WAITER_STORAGE_KEY = "orderez-waiter-v1";
const ADMIN_SESSION_KEY = "orderez-admin-session-v1";
const ADMIN_PASSCODE = "1234";
const ORDER_STATUS_STEPS = ["pending", "preparing", "served"];
const CATEGORY_ORDER = ["Starters", "Main Course", "Drinks", "Desserts"];
const STATUS_LABELS = { pending: "Pending", preparing: "Preparing", served: "Served" };
const EMPTY_FILTERS = { category: "All", query: "" };

const MENU_ITEMS = [
  { id: "smoked-paneer", name: "Smoked Paneer Skewers", category: "Starters", price: 245, prepTime: "10 min", tag: "Chef special", description: "Charred cottage cheese, mint yogurt, pickled onions." },
  { id: "crispy-lotus", name: "Crispy Lotus Stem", category: "Starters", price: 210, prepTime: "8 min", tag: "Popular", description: "Honey chilli glaze with toasted sesame crunch." },
  { id: "truffle-fries", name: "Truffle Pepper Fries", category: "Starters", price: 180, prepTime: "7 min", tag: "Fast", description: "Skin-on fries finished with parmesan and pepper dust." },
  { id: "butter-chicken", name: "Firepot Butter Chicken", category: "Main Course", price: 360, prepTime: "18 min", tag: "Best seller", description: "Silky tomato gravy, smoked spice oil, soft naan pairing." },
  { id: "mushroom-risotto", name: "Forest Mushroom Risotto", category: "Main Course", price: 340, prepTime: "20 min", tag: "Veg", description: "Creamy arborio rice with roasted garlic and parmesan." },
  { id: "ramen-bowl", name: "Midnight Ramen Bowl", category: "Main Course", price: 325, prepTime: "16 min", tag: "Comfort", description: "Soy broth, spring onion, soft egg, roasted vegetables." },
  { id: "cold-brew", name: "Citrus Cold Brew", category: "Drinks", price: 140, prepTime: "3 min", tag: "Refresh", description: "House cold brew lifted with orange peel and tonic." },
  { id: "mango-fizz", name: "Mango Basil Fizz", category: "Drinks", price: 155, prepTime: "4 min", tag: "Seasonal", description: "Fresh mango, basil syrup, sparkling water." },
  { id: "cocoa-tart", name: "Dark Cocoa Tart", category: "Desserts", price: 195, prepTime: "5 min", tag: "Finish strong", description: "Salted caramel, cacao nibs, vanilla creme." },
];

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function getInitialState() {
  if (typeof window === "undefined") {
    return { orders: [], calls: [] };
  }

  const storedState = window.localStorage.getItem(STORAGE_KEY);
  const storedCalls = window.localStorage.getItem(WAITER_STORAGE_KEY);

  return {
    orders: storedState ? JSON.parse(storedState) : [],
    calls: storedCalls ? JSON.parse(storedCalls) : [],
  };
}

function readTableNumber() {
  const params = new URLSearchParams(window.location.search);
  const table = params.get("table");
  return table ? table.trim() : "5";
}

function isAdminRoute() {
  return window.location.pathname.replace(/\/+$/, "") === "/admin";
}

function deriveStatus(createdAt) {
  const elapsedMinutes = Math.floor((Date.now() - createdAt) / 60000);
  if (elapsedMinutes >= 10) return "served";
  if (elapsedMinutes >= 4) return "preparing";
  return "pending";
}

function getStatusTone(status) {
  if (status === "served") return "tone-served";
  if (status === "preparing") return "tone-preparing";
  return "tone-pending";
}

function calculateOrderTotals(cart) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gst = Math.round(subtotal * GST_RATE);
  return { subtotal, gst, total: subtotal + gst };
}

function App() {
  const initialState = useMemo(() => getInitialState(), []);
  const [tableNumber] = useState(readTableNumber);
  const [orders, setOrders] = useState(initialState.orders);
  const [waiterCalls, setWaiterCalls] = useState(initialState.calls);
  const [cart, setCart] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [activeView] = useState(() => (isAdminRoute() ? "admin" : "guest"));
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [billSplit, setBillSplit] = useState(2);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === "true";
  });
  const deferredQuery = useDeferredValue(filters.query);

  useEffect(() => {
    const syncState = () => {
      const state = getInitialState();
      setOrders(state.orders);
      setWaiterCalls(state.calls);
    };

    window.addEventListener("storage", syncState);
    return () => window.removeEventListener("storage", syncState);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    window.localStorage.setItem(WAITER_STORAGE_KEY, JSON.stringify(waiterCalls));
  }, [waiterCalls]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setOrders((currentOrders) =>
        currentOrders.map((order) => {
          const liveStatus = deriveStatus(order.createdAt);
          return liveStatus === order.status ? order : { ...order, status: liveStatus };
        }),
      );
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const categories = useMemo(() => ["All", ...CATEGORY_ORDER], []);
  const menuItems = useMemo(() => {
    const query = deferredQuery.toLowerCase().trim();
    return MENU_ITEMS.filter((item) => {
      const matchesCategory = filters.category === "All" || item.category === filters.category;
      const matchesQuery =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tag.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [deferredQuery, filters.category]);

  const cartTotals = useMemo(() => calculateOrderTotals(cart), [cart]);
  const activeOrder = useMemo(
    () =>
      orders
        .filter((order) => String(order.tableNumber) === String(tableNumber))
        .toSorted((left, right) => right.createdAt - left.createdAt)[0] ?? null,
    [orders, tableNumber],
  );
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? activeOrder,
    [activeOrder, orders, selectedOrderId],
  );
  const salesToday = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);
  const pendingOrders = useMemo(() => orders.filter((order) => order.status !== "served"), [orders]);

  function updateFilter(name, value) {
    startTransition(() => {
      setFilters((current) => ({ ...current, [name]: value }));
    });
  }

  function addToCart(item) {
    setCart((currentCart) => {
      const existingItem = currentCart.find((cartItem) => cartItem.id === item.id);
      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem,
        );
      }
      return [...currentCart, { ...item, quantity: 1 }];
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

  function placeOrder() {
    if (!cart.length) return;

    const newOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      tableNumber,
      items: cart,
      status: "pending",
      createdAt: Date.now(),
      ...cartTotals,
    };

    setOrders((currentOrders) => [newOrder, ...currentOrders]);
    setSelectedOrderId(newOrder.id);
    setCart([]);
  }

  function requestWaiter() {
    const call = { id: `CALL-${Date.now().toString().slice(-5)}`, tableNumber, createdAt: Date.now() };
    setWaiterCalls((currentCalls) => [call, ...currentCalls].slice(0, 8));
  }

  function updateOrderStatus(orderId, nextStatus) {
    setOrders((currentOrders) =>
      currentOrders.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order)),
    );
  }

  function unlockAdmin(event) {
    event.preventDefault();

    if (adminPasscode !== ADMIN_PASSCODE) {
      setAdminError("Incorrect passcode. Use 1234 for this demo.");
      return;
    }

    window.sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
    setAdminUnlocked(true);
    setAdminError("");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">QR Dining OS</p>
          <h1>OrderEZ</h1>
        </div>
        <div className="topbar-actions">
          {activeView === "guest" ? (
            <>
              <div className="table-chip">Table {tableNumber}</div>
              <a className="ghost-link" href="/admin">Staff login</a>
            </>
          ) : (
            <>
              <div className="table-chip">Back office</div>
              <a className="ghost-link" href={`/?table=${tableNumber}`}>Customer menu</a>
            </>
          )}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Table-first ordering for modern dining rooms</p>
            <h2>Scan, order, track, and settle the bill without waiting for the menu.</h2>
            <p className="hero-text">
              {activeView === "guest"
                ? "Built as a placement-ready restaurant workflow: QR table routing, GST billing, live order states, and waiter assist for a single table."
                : "A staff-only operations surface for kitchen flow, waiter requests, and live order handling across the dining room."}
            </p>
            <div className="hero-actions">
              {activeView === "guest" ? (
                <>
                  <button className="primary-button" onClick={() => window.scrollTo({ top: 560, behavior: "smooth" })}>Start ordering</button>
                  <button className="secondary-button" onClick={requestWaiter}>Call waiter</button>
                </>
              ) : (
                <>
                  <button className="primary-button" onClick={() => window.scrollTo({ top: 560, behavior: "smooth" })}>Open queue</button>
                  <a className="secondary-link" href={`/?table=${tableNumber}`}>View customer flow</a>
                </>
              )}
            </div>
          </div>

          <div className="hero-panel">
            <div className="stat-strip">
              <span>{orders.length} orders today</span>
              <span>{pendingOrders.length} live in kitchen</span>
              <span>{currency.format(salesToday)} revenue</span>
            </div>
            <div className="hero-visual">
              <div className="orb orb-one" />
              <div className="orb orb-two" />
              <div className="visual-card">
                <p>Current order</p>
                <strong>{activeOrder ? activeOrder.id : "No order yet"}</strong>
                <span className={`status-pill ${getStatusTone(activeOrder?.status ?? "pending")}`}>
                  {activeView === "guest"
                    ? activeOrder ? STATUS_LABELS[activeOrder.status] : "Ready to order"
                    : `${pendingOrders.length} active`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {activeView === "guest" ? (
          <GuestView
            activeOrder={activeOrder}
            addToCart={addToCart}
            billSplit={billSplit}
            cart={cart}
            cartTotals={cartTotals}
            categories={categories}
            changeQuantity={changeQuantity}
            filters={filters}
            menuItems={menuItems}
            placeOrder={placeOrder}
            requestWaiter={requestWaiter}
            setBillSplit={setBillSplit}
            updateFilter={updateFilter}
          />
        ) : !adminUnlocked ? (
          <AdminLogin
            adminError={adminError}
            adminPasscode={adminPasscode}
            onChangePasscode={setAdminPasscode}
            onUnlock={unlockAdmin}
          />
        ) : (
          <AdminView
            orders={orders}
            onClearWaiterCall={(callId) => setWaiterCalls((currentCalls) => currentCalls.filter((call) => call.id !== callId))}
            onSelectOrder={setSelectedOrderId}
            onUpdateOrderStatus={updateOrderStatus}
            selectedOrder={selectedOrder}
            waiterCalls={waiterCalls}
          />
        )}
      </main>
    </div>
  );
}

function AdminLogin({ adminError, adminPasscode, onChangePasscode, onUnlock }) {
  return (
    <section className="admin-login">
      <div className="login-card">
        <p className="eyebrow">Staff access</p>
        <h3>Admin dashboard is separated from the guest menu now.</h3>
        <p className="hero-text">
          This is still a demo, so the login uses a simple passcode gate. In the real build, this would be JWT auth backed by the server.
        </p>
        <form className="login-form" onSubmit={onUnlock}>
          <input
            className="search-input"
            type="password"
            value={adminPasscode}
            onChange={(event) => onChangePasscode(event.target.value)}
            placeholder="Enter demo passcode"
          />
          <button className="primary-button" type="submit">Unlock admin</button>
        </form>
        <p className="helper-text">Demo passcode: 1234</p>
        {adminError ? <p className="error-text">{adminError}</p> : null}
      </div>
    </section>
  );
}

function GuestView({ activeOrder, addToCart, billSplit, cart, cartTotals, categories, changeQuantity, filters, menuItems, placeOrder, requestWaiter, setBillSplit, updateFilter }) {
  const splitAmount = cartTotals.total / billSplit;

  return (
    <div className="workspace">
      <section className="menu-space">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Menu</p>
            <h3>Crafted for fast table ordering</h3>
          </div>
          <button className="secondary-button" onClick={requestWaiter}>Call waiter</button>
        </div>

        <div className="filter-row">
          <input className="search-input" type="search" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="Search dish, vibe, or tag" />
          <div className="category-row">
            {categories.map((category) => (
              <button key={category} className={`filter-chip ${filters.category === category ? "active" : ""}`} onClick={() => updateFilter("category", category)}>
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-grid">
          {menuItems.map((item) => (
            <article key={item.id} className="menu-item">
              <div className="menu-item-head">
                <div>
                  <p className="item-category">{item.category}</p>
                  <h4>{item.name}</h4>
                </div>
                <span className="item-tag">{item.tag}</span>
              </div>
              <p className="item-description">{item.description}</p>
              <div className="menu-item-foot">
                <div>
                  <strong>{currency.format(item.price)}</strong>
                  <span>{item.prepTime}</span>
                </div>
                <button className="primary-button compact" onClick={() => addToCart(item)}>Add</button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="side-panel">
        <section className="summary-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">Order summary</p>
              <h3>Cart and bill</h3>
            </div>
          </div>

          {cart.length ? (
            <div className="cart-list">
              {cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{currency.format(item.price)}</span>
                  </div>
                  <div className="qty-control">
                    <button onClick={() => changeQuantity(item.id, item.quantity - 1)}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => changeQuantity(item.id, item.quantity + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">Add dishes to build your order for the table.</p>
          )}

          <div className="bill-row"><span>Subtotal</span><strong>{currency.format(cartTotals.subtotal)}</strong></div>
          <div className="bill-row"><span>GST (18%)</span><strong>{currency.format(cartTotals.gst)}</strong></div>
          <div className="bill-row total"><span>Total</span><strong>{currency.format(cartTotals.total)}</strong></div>

          <div className="splitter">
            <label htmlFor="split">Split bill</label>
            <input id="split" type="range" min="1" max="6" value={billSplit} onChange={(event) => setBillSplit(Number(event.target.value))} />
            <span>{billSplit} guests per split | {currency.format(splitAmount || 0)} each</span>
          </div>

          <button className="primary-button full-width" disabled={!cart.length} onClick={placeOrder}>Place order</button>
        </section>

        <section className="tracking-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">Live status</p>
              <h3>Track your latest order</h3>
            </div>
          </div>
          {activeOrder ? (
            <>
              <div className="tracking-head">
                <strong>{activeOrder.id}</strong>
                <span className={`status-pill ${getStatusTone(activeOrder.status)}`}>{STATUS_LABELS[activeOrder.status]}</span>
              </div>
              <div className="progress-steps">
                {ORDER_STATUS_STEPS.map((step) => {
                  const activeIndex = ORDER_STATUS_STEPS.indexOf(activeOrder.status);
                  const stepIndex = ORDER_STATUS_STEPS.indexOf(step);
                  return (
                    <div key={step} className={`progress-step ${stepIndex <= activeIndex ? "done" : ""}`}>
                      <span />
                      <p>{STATUS_LABELS[step]}</p>
                    </div>
                  );
                })}
              </div>
              <div className="bill-card">
                <span>Bill total</span>
                <strong>{currency.format(activeOrder.total)}</strong>
              </div>
            </>
          ) : (
            <p className="empty-state">Your placed order will appear here with real-time status updates.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

function AdminView({ orders, onClearWaiterCall, onSelectOrder, onUpdateOrderStatus, selectedOrder, waiterCalls }) {
  return (
    <div className="workspace admin-layout">
      <section className="ops-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Operations</p>
            <h3>Kitchen and floor dashboard</h3>
          </div>
        </div>

        <div className="kpi-row">
          <article className="kpi"><span>Open orders</span><strong>{orders.filter((order) => order.status !== "served").length}</strong></article>
          <article className="kpi"><span>Served today</span><strong>{orders.filter((order) => order.status === "served").length}</strong></article>
          <article className="kpi"><span>Waiter calls</span><strong>{waiterCalls.length}</strong></article>
        </div>

        <div className="orders-list">
          {orders.length ? (
            orders.toSorted((left, right) => right.createdAt - left.createdAt).map((order) => (
              <button key={order.id} className={`order-row ${selectedOrder?.id === order.id ? "active" : ""}`} onClick={() => onSelectOrder(order.id)}>
                <div>
                  <strong>{order.id}</strong>
                  <span>Table {order.tableNumber}</span>
                </div>
                <div>
                  <span className={`status-pill ${getStatusTone(order.status)}`}>{STATUS_LABELS[order.status]}</span>
                  <small>{currency.format(order.total)}</small>
                </div>
              </button>
            ))
          ) : (
            <p className="empty-state">Orders will appear here as soon as guests place them.</p>
          )}
        </div>
      </section>

      <aside className="inspector-panel">
        <section className="summary-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">Selected order</p>
              <h3>{selectedOrder ? selectedOrder.id : "No order selected"}</h3>
            </div>
          </div>

          {selectedOrder ? (
            <>
              <div className="bill-card">
                <span>Table {selectedOrder.tableNumber}</span>
                <strong>{currency.format(selectedOrder.total)}</strong>
              </div>
              <div className="cart-list">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="cart-item static">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.quantity} x {currency.format(item.price)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="status-actions">
                {ORDER_STATUS_STEPS.map((status) => (
                  <button key={status} className={`ghost-button ${selectedOrder.status === status ? "active" : ""}`} onClick={() => onUpdateOrderStatus(selectedOrder.id, status)}>
                    Mark {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">Pick an order from the queue to inspect items and update status.</p>
          )}
        </section>

        <section className="tracking-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">Floor assistance</p>
              <h3>Recent waiter calls</h3>
            </div>
          </div>

          {waiterCalls.length ? (
            <div className="cart-list">
              {waiterCalls.map((call) => (
                <div key={call.id} className="cart-item">
                  <div>
                    <strong>Table {call.tableNumber}</strong>
                    <span>{new Date(call.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <button className="secondary-button compact" onClick={() => onClearWaiterCall(call.id)}>Clear</button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No active waiter requests right now.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

export default App;
