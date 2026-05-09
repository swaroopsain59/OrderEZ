import { useEffect, useMemo, useState } from "react";
import { currency, getStatusTone, ORDER_STATUS_STEPS, STATUS_LABELS } from "../format";

const GUEST_SECTIONS = ["home", "menu", "orders"];

function GuestView({
  activeOrder,
  addToCart,
  billSplit,
  cart,
  cartTotals,
  categories,
  cancelOrder,
  changeQuantity,
  errorMessage,
  filteredMenuItems,
  filters,
  isSubmitting,
  placeOrder,
  requestWaiter,
  restaurant,
  setBillSplit,
  splitAmount,
  tableCode,
  updateFilter,
}) {
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [sheetItem, setSheetItem] = useState(null);
  const [sheetQuantity, setSheetQuantity] = useState(1);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );
  const signatureItems = useMemo(
    () => filteredMenuItems.filter((item) => /signature|best seller|popular/i.test(item.tag)).slice(0, 6),
    [filteredMenuItems],
  );
  const restaurantInitials = useMemo(
    () =>
      (restaurant?.name ?? "OrderEZ")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [restaurant?.name],
  );

  useEffect(() => {
    setIsOrderOpen(Boolean(activeOrder) && !["served", "paid", "cancelled"].includes(activeOrder.status));
  }, [activeOrder?.id, activeOrder?.status]);

  useEffect(() => {
    const onScroll = () => {
      const nextSection =
        GUEST_SECTIONS.find((sectionId) => {
          const section = document.getElementById(`guest-${sectionId}`);
          if (!section) return false;
          const bounds = section.getBoundingClientRect();
          return bounds.top <= 180 && bounds.bottom >= 180;
        }) ?? "home";
      setActiveSection(nextSection);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!sheetItem) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setSheetItem(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sheetItem]);

  function openSection(sectionId) {
    setActiveSection(sectionId);
    document.getElementById(`guest-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openAddSheet(item) {
    const existingItem = cart.find((entry) => entry.id === item.id);
    setSheetItem(item);
    setSheetQuantity(Math.max(1, existingItem?.quantity ?? 1));
  }

  function confirmAddToCart() {
    if (!sheetItem) return;

    const existingItem = cart.find((entry) => entry.id === sheetItem.id);
    const existingQuantity = existingItem?.quantity ?? 0;
    const quantityToAdd = Math.max(1, sheetQuantity - existingQuantity);

    if (quantityToAdd > 0) {
      addToCart(sheetItem, quantityToAdd);
    }

    if (quantityToAdd <= 0 && existingItem) {
      changeQuantity(sheetItem.id, sheetQuantity);
    }

    setSheetItem(null);
  }

  return (
    <div className="guest-flow">
      <header className="guest-appbar">
        <div className="guest-appbar-brand">
          <div className="guest-appbar-logo" aria-hidden="true">OZ</div>
          <div>
            <p className="eyebrow">OrderEZ</p>
            <strong>Guest ordering</strong>
          </div>
        </div>

        <div className="guest-quick-menu-wrap">
          <button
            type="button"
            className={`guest-quick-menu-button ${isQuickMenuOpen ? "active" : ""}`}
            onClick={() => setIsQuickMenuOpen((current) => !current)}
            aria-label="Open quick menu"
            aria-expanded={isQuickMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>

          {isQuickMenuOpen ? (
            <div className="guest-quick-menu">
              <button type="button" className="guest-menu-action" onClick={() => { requestWaiter(); setIsQuickMenuOpen(false); }}>
                Call waiter
              </button>
              <button type="button" className="guest-menu-action" onClick={() => { openSection("orders"); setIsQuickMenuOpen(false); }}>
                View cart
              </button>
              <a className="guest-menu-action" href={`/admin/${restaurant?.slug ?? "gulab-ji-chai-bani-park"}`}>
                Staff login
              </a>
            </div>
          ) : null}
        </div>
      </header>

      <section id="guest-home" className="guest-section guest-home-panel">
        <div className="guest-home-head">
          <div className="guest-brand">
            <div className="guest-logo-mark" aria-hidden="true">{restaurantInitials}</div>
            <div>
              <p className="eyebrow">Table {tableCode}</p>
              <h3>{restaurant?.name ?? "Restaurant"}</h3>
              <p className="guest-subtitle">{restaurant?.tagline ?? "Fast table ordering with live kitchen status."}</p>
            </div>
          </div>

          <div className="table-chip">Table {tableCode}</div>
        </div>

        <div className="guest-home-grid">
          <div className="guest-home-copy">
            <h2>Scan, choose, and place your order without losing your place at the table.</h2>
            <p>
              Keep the essentials right here: menu discovery, cart review, and live order tracking.
              Everything else sits quietly behind the quick menu.
            </p>
            <div className="guest-home-actions">
              <button type="button" className="primary-button" onClick={() => openSection("menu")}>
                Order now
              </button>
              <button type="button" className="secondary-button" onClick={requestWaiter}>
                Call waiter
              </button>
            </div>
            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          </div>

          <div className="guest-home-card-stack">
            <div className="guest-snapshot-card">
              <span>Live menu</span>
              <strong>{filteredMenuItems.length}</strong>
              <p>Dishes ready for this table right now.</p>
            </div>
            <div className="guest-snapshot-card warm">
              <span>Current cart</span>
              <strong>{cartCount}</strong>
              <p>{cartCount ? `${currency.format(cartTotals.total)} waiting in your tray.` : "Nothing added yet."}</p>
            </div>
            <div className="guest-snapshot-card accent">
              <span>Latest order</span>
              <strong>{activeOrder ? STATUS_LABELS[activeOrder.status] : "Ready"}</strong>
              <p>{activeOrder ? `Order #${activeOrder.id.slice(0, 8)} is being tracked live.` : "Place an order to start live tracking."}</p>
            </div>
          </div>
        </div>
      </section>

      <section id="guest-menu" className="guest-section guest-menu-panel">
        <div className="guest-menu-sticky">
          <div className="section-heading guest-menu-heading">
            <div>
              <p className="eyebrow">Menu</p>
              <h3>Everything worth ordering, without the clutter</h3>
            </div>
            <button type="button" className="secondary-button compact" onClick={requestWaiter}>
              Call waiter
            </button>
          </div>

          <input
            className="search-input guest-search"
            type="search"
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Search chai, snacks, sandwiches, or tags"
          />

          {signatureItems.length ? (
            <div className="signature-strip">
              {signatureItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="signature-chip"
                  onClick={() => openAddSheet(item)}
                >
                  <span>{item.tag}</span>
                  <strong>{item.name}</strong>
                </button>
              ))}
            </div>
          ) : null}

          <div className="category-row guest-category-row">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={`filter-chip ${filters.category === category ? "active" : ""}`}
                onClick={() => updateFilter("category", category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="guest-dish-list">
          {filteredMenuItems.map((item) => {
            const cartItem = cart.find((entry) => entry.id === item.id);

            return (
              <article key={item.id} className="guest-dish-card">
                <div className="guest-dish-copy">
                  <div className="guest-dish-head">
                    <div>
                      <p className="item-category">{item.category}</p>
                      <h4>{item.name}</h4>
                    </div>
                    <span className="item-tag">{item.tag}</span>
                  </div>
                  <p className="item-description">{item.description}</p>
                </div>

                <div className="guest-dish-meta">
                  <div className="menu-item-price">
                    <strong>{currency.format(item.price)}</strong>
                    <span>{item.prepTime}</span>
                  </div>
                  <button
                    type="button"
                    className={`${cartItem ? "secondary-button" : "primary-button"} compact`}
                    onClick={() => openAddSheet(item)}
                  >
                    {cartItem ? `${cartItem.quantity} in cart` : "Add"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="guest-orders" className="guest-section guest-orders-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Orders</p>
            <h3>Cart, billing, and live tracking</h3>
          </div>
        </div>

        <div className="guest-orders-grid">
          <section className="guest-orders-card">
            <div className="guest-orders-card-head">
              <div>
                <p className="eyebrow">Order summary</p>
                <h4>Your tray</h4>
              </div>
              <span className="status-pill tone-pending">{cartCount} items</span>
            </div>

            {cart.length ? (
              <div className="cart-list">
                {cart.map((item) => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-meta">
                      <strong>{item.name}</strong>
                      <span>{currency.format(item.price)}</span>
                    </div>
                    <div className="qty-control">
                      <button type="button" onClick={() => changeQuantity(item.id, item.quantity - 1)}>-</button>
                      <span>{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Your cart is empty right now. Head to Menu and start with a chai or signature snack.</p>
            )}

            <div className="bill-row"><span>Subtotal</span><strong>{currency.format(cartTotals.subtotal)}</strong></div>
            <div className="bill-row"><span>GST (18%)</span><strong>{currency.format(cartTotals.gst)}</strong></div>
            <div className="bill-row total"><span>Total</span><strong>{currency.format(cartTotals.total)}</strong></div>

            <div className="splitter">
              <label htmlFor="split">Split bill</label>
              <input
                id="split"
                type="range"
                min="1"
                max="6"
                value={billSplit}
                onChange={(event) => setBillSplit(Number(event.target.value))}
              />
              <span>{billSplit} guests per split | {currency.format(splitAmount || 0)} each</span>
            </div>

            <div className="guest-place-box">
              <div>
                <strong>Send this cheerful tray to the kitchen</strong>
                <p>One tap, then sit back while the team prepares everything for table {tableCode}.</p>
              </div>
              <button className="primary-button full-width" disabled={!cart.length || isSubmitting} onClick={placeOrder}>
                {isSubmitting ? "Placing order..." : "Place order"}
              </button>
            </div>
          </section>

          <section className="guest-orders-card">
            <div className="guest-orders-card-head">
              <div>
                <p className="eyebrow">Live status</p>
                <h4>Track your latest order</h4>
              </div>
              {activeOrder ? (
                <span className={`status-pill ${getStatusTone(activeOrder.status)}`}>{STATUS_LABELS[activeOrder.status]}</span>
              ) : null}
            </div>

            {activeOrder ? (
              <>
                <button className="order-focus-card guest-order-focus" type="button" onClick={() => setIsOrderOpen((current) => !current)}>
                  <div className="order-focus-summary">
                    <div className="order-focus-meta">
                      <span>Order #{activeOrder.id.slice(0, 8)}</span>
                      <strong>{currency.format(activeOrder.total)}</strong>
                    </div>
                    <div className="order-focus-side">
                      <span className={`status-pill ${getStatusTone(activeOrder.status)}`}>{STATUS_LABELS[activeOrder.status]}</span>
                      <span className="toggle-indicator" aria-hidden="true">{isOrderOpen ? "Hide details" : "View details"}</span>
                    </div>
                  </div>
                </button>

                {isOrderOpen ? (
                  <>
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

                    <div className="cart-list guest-static-order-list">
                      {activeOrder.items.map((item) => (
                        <div key={`${activeOrder.id}-${item.id}`} className="cart-item static">
                          <div>
                            <strong>{item.name}</strong>
                            <span>{item.quantity} x {currency.format(item.price)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {activeOrder.status === "pending" ? (
                      <button className="secondary-button full-width" disabled={isSubmitting} onClick={cancelOrder}>
                        {isSubmitting ? "Cancelling..." : "Cancel order"}
                      </button>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <p className="empty-state">Once you place an order, its full progress will live here from pending to served.</p>
            )}
          </section>
        </div>
      </section>

      {cartCount ? (
        <div className="guest-cart-banner">
          <div>
            <strong>{cartCount} item{cartCount > 1 ? "s" : ""} added</strong>
            <span>{currency.format(cartTotals.total)} waiting in your cart</span>
          </div>
          <button type="button" className="primary-button compact" onClick={() => openSection("orders")}>
            View cart
          </button>
        </div>
      ) : null}

      {sheetItem ? (
        <>
          <button type="button" className="guest-sheet-scrim" aria-label="Close dish sheet" onClick={() => setSheetItem(null)} />
          <div className="guest-sheet" role="dialog" aria-modal="true" aria-label={`Add ${sheetItem.name}`}>
            <div className="guest-sheet-handle" aria-hidden="true" />
            <div className="guest-sheet-head">
              <div>
                <p className="eyebrow">{sheetItem.category}</p>
                <h3>{sheetItem.name}</h3>
                <p className="guest-subtitle">{sheetItem.description}</p>
              </div>
              <span className="item-tag">{sheetItem.tag}</span>
            </div>
            <div className="guest-sheet-foot">
              <div className="qty-control guest-sheet-qty">
                <button type="button" onClick={() => setSheetQuantity((current) => Math.max(1, current - 1))}>-</button>
                <span>{sheetQuantity}</span>
                <button type="button" onClick={() => setSheetQuantity((current) => current + 1)}>+</button>
              </div>
              <button type="button" className="primary-button" onClick={confirmAddToCart}>
                Add to cart | {currency.format(sheetItem.price * sheetQuantity)}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <nav className="guest-bottom-nav" aria-label="Guest sections">
        {GUEST_SECTIONS.map((sectionId) => (
          <button
            key={sectionId}
            type="button"
            className={`guest-nav-link ${activeSection === sectionId ? "active" : ""}`}
            onClick={() => openSection(sectionId)}
          >
            {sectionId === "home" ? "Home" : sectionId === "menu" ? "Menu" : "Orders"}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default GuestView;
