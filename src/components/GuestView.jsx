import { useEffect, useState } from "react";
import { currency, getStatusTone, ORDER_STATUS_STEPS, STATUS_LABELS } from "../format";

function GuestView({
  activeOrder,
  addToCart,
  billSplit,
  cart,
  cartTotals,
  categories,
  cancelOrder,
  changeQuantity,
  filteredMenuItems,
  filters,
  isSubmitting,
  placeOrder,
  requestWaiter,
  setBillSplit,
  splitAmount,
  updateFilter,
}) {
  const [isOrderOpen, setIsOrderOpen] = useState(false);

  useEffect(() => {
    setIsOrderOpen(Boolean(activeOrder) && !["served", "paid", "cancelled"].includes(activeOrder.status));
  }, [activeOrder?.id, activeOrder?.status]);

  return (
    <div className="workspace">
      <section className="menu-space">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Menu</p>
            <h3>Crafted for fast table ordering</h3>
          </div>
          <button className="secondary-button" onClick={requestWaiter}>
            Call waiter
          </button>
        </div>

        <div className="filter-row">
          <input
            className="search-input"
            type="search"
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            placeholder="Search dish, vibe, or tag"
          />
          <div className="category-row">
            {categories.map((category) => (
              <button
                key={category}
                className={`filter-chip ${filters.category === category ? "active" : ""}`}
                onClick={() => updateFilter("category", category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="menu-grid">
          {filteredMenuItems.map((item) => {
            const cartItem = cart.find((entry) => entry.id === item.id);
            return (
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
                  <div className="menu-item-price">
                    <strong>{currency.format(item.price)}</strong>
                    <span>{item.prepTime}</span>
                  </div>
                  <button
                    className={`${cartItem ? "secondary-button" : "primary-button"} compact`}
                    onClick={() => addToCart(item)}
                  >
                    {cartItem ? `Added (${cartItem.quantity})` : "Add"}
                  </button>
                </div>
              </article>
            );
          })}
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
                  <div className="cart-item-meta">
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

          <button className="primary-button full-width" disabled={!cart.length || isSubmitting} onClick={placeOrder}>
            {isSubmitting ? "Placing order..." : "Place order"}
          </button>
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
              <button className="order-focus-card" type="button" onClick={() => setIsOrderOpen((current) => !current)}>
                <div className="order-focus-summary">
                  <div className="order-focus-meta">
                    <span>Order #{activeOrder.id.slice(0, 8)}</span>
                    <strong>{currency.format(activeOrder.total)}</strong>
                  </div>
                  <div className="order-focus-side">
                    <span className={`status-pill ${getStatusTone(activeOrder.status)}`}>{STATUS_LABELS[activeOrder.status]}</span>
                    <span className="toggle-indicator" aria-hidden="true">{isOrderOpen ? "Hide" : "View"}</span>
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
                  <div className="bill-card">
                    <span>Bill total</span>
                    <strong>{currency.format(activeOrder.total)}</strong>
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
            <p className="empty-state">Your placed order will appear here with real-time status updates.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

export default GuestView;
