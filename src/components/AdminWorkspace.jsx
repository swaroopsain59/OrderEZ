import { useEffect, useState } from "react";
import { currency, getStatusTone, ORDER_STATUS_STEPS, STATUS_LABELS } from "../format";

const EMPTY_MENU_FORM = {
  name: "",
  category: "Gulabji Special",
  price: "",
  prepTime: "5 min",
  tag: "New",
  description: "",
};

function AdminWorkspace({
  historyOrders,
  menuItems,
  onClearWaiterCall,
  onCreateMenuItem,
  onDeleteMenuItem,
  onSelectOrder,
  onUpdateMenuItem,
  onUpdateOrderStatus,
  orders,
  selectedOrder,
  summary,
  tables,
  updatingOrderId,
  waiterCalls,
}) {
  const [drafts, setDrafts] = useState({});
  const [newItem, setNewItem] = useState(EMPTY_MENU_FORM);
  const [menuMessage, setMenuMessage] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSelectedOrderOpen, setIsSelectedOrderOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isQrSectionOpen, setIsQrSectionOpen] = useState(false);
  const [openQrTableCode, setOpenQrTableCode] = useState("");
  const currentOrder = selectedOrder && Array.isArray(selectedOrder.items) ? selectedOrder : null;

  useEffect(() => {
    setIsSelectedOrderOpen(Boolean(currentOrder) && !["served", "paid"].includes(currentOrder.status));
  }, [currentOrder?.id, currentOrder?.status]);

  function readDraft(item) {
    return drafts[item.id] ?? {
      name: item.name,
      category: item.category,
      price: String(item.price),
      prepTime: item.prepTime,
      tag: item.tag,
      description: item.description,
    };
  }

  async function saveItem(item) {
    const draft = readDraft(item);
    await onUpdateMenuItem(item.id, { ...draft, price: Number(draft.price) });
    setMenuMessage(`Saved ${draft.name}.`);
  }

  async function createItem(event) {
    event.preventDefault();
    await onCreateMenuItem({ ...newItem, price: Number(newItem.price) });
    setNewItem(EMPTY_MENU_FORM);
    setMenuMessage("Added new menu item.");
  }

  async function removeItem(menuItemId) {
    await onDeleteMenuItem(menuItemId);
    setMenuMessage("Deleted menu item.");
  }

  return (
    <div className="workspace admin-layout">
      <section className="ops-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Operations</p>
            <h3>Kitchen, floor, and menu dashboard</h3>
          </div>
        </div>

        <div className="kpi-row">
          <article className="kpi"><span>Open orders</span><strong>{summary.openOrders}</strong></article>
          <article className="kpi"><span>Orders today</span><strong>{summary.totalOrders}</strong></article>
          <article className="kpi"><span>Waiter calls</span><strong>{summary.waiterCalls}</strong></article>
        </div>

        <div className="orders-list">
          {orders.length ? (
            orders.map((order) => (
              <button
                key={order.id}
                className={`order-row ${currentOrder?.id === order.id ? "active" : ""}`}
                onClick={() => onSelectOrder(order.id)}
              >
                <div>
                  <strong>{order.id.slice(0, 8)}</strong>
                  <span>Table {order.tableCode}</span>
                </div>
                <div>
                  <span className={`status-pill ${getStatusTone(order.status)}`}>{STATUS_LABELS[order.status]}</span>
                  <small>{currency.format(order.total)}</small>
                </div>
              </button>
            ))
          ) : (
            <p className="empty-state">Today's orders will appear here as soon as guests place them.</p>
          )}
        </div>

        <section className="summary-panel history-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">History</p>
              <h3>Paid and older orders</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => setIsHistoryOpen((current) => !current)}>
              {isHistoryOpen ? "Hide history" : "View history"}
            </button>
          </div>
          <div className={`menu-collapse ${isHistoryOpen ? "open" : ""}`}>
            <div className="menu-collapse-inner">
              {historyOrders.length ? (
                <div className="orders-list">
                  {historyOrders.map((order) => (
                    <button
                      key={order.id}
                      className={`order-row ${currentOrder?.id === order.id ? "active" : ""}`}
                      onClick={() => onSelectOrder(order.id)}
                    >
                      <div>
                        <strong>{order.id.slice(0, 8)}</strong>
                        <span>Table {order.tableCode}</span>
                      </div>
                      <div>
                        <span className={`status-pill ${getStatusTone(order.status)}`}>{STATUS_LABELS[order.status]}</span>
                        <small>{currency.format(order.total)}</small>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty-state">No paid or older orders yet.</p>
              )}
            </div>
          </div>
        </section>

        <section className="summary-panel admin-menu-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">Menu manager</p>
              <h3>Edit menu items in MySQL</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => setIsMenuOpen((current) => !current)}>
              {isMenuOpen ? "Hide editor" : "Manage menu"}
            </button>
          </div>
          <div className={`menu-collapse ${isMenuOpen ? "open" : ""}`}>
            <div className="menu-collapse-inner">
              {menuMessage ? <p className="helper-text">{menuMessage}</p> : null}

              <form className="menu-editor add-form" onSubmit={createItem}>
                <input className="search-input" value={newItem.name} onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} placeholder="Item name" />
                <input className="search-input" value={newItem.category} onChange={(event) => setNewItem((current) => ({ ...current, category: event.target.value }))} placeholder="Category" />
                <input className="search-input" type="number" value={newItem.price} onChange={(event) => setNewItem((current) => ({ ...current, price: event.target.value }))} placeholder="Price" />
                <input className="search-input" value={newItem.prepTime} onChange={(event) => setNewItem((current) => ({ ...current, prepTime: event.target.value }))} placeholder="Prep time" />
                <input className="search-input" value={newItem.tag} onChange={(event) => setNewItem((current) => ({ ...current, tag: event.target.value }))} placeholder="Tag" />
                <textarea className="search-input text-area" value={newItem.description} onChange={(event) => setNewItem((current) => ({ ...current, description: event.target.value }))} placeholder="Description" />
                <button className="primary-button" type="submit">Add menu item</button>
              </form>

              <div className="menu-admin-list">
                {menuItems.map((item) => {
                  const draft = readDraft(item);
                  return (
                    <article key={item.id} className="menu-admin-card">
                      <div className="menu-admin-grid">
                        <input className="search-input" value={draft.name} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, name: event.target.value } }))} />
                        <input className="search-input" value={draft.category} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, category: event.target.value } }))} />
                        <input className="search-input" type="number" value={draft.price} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, price: event.target.value } }))} />
                        <input className="search-input" value={draft.prepTime} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, prepTime: event.target.value } }))} />
                        <input className="search-input" value={draft.tag} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, tag: event.target.value } }))} />
                        <textarea className="search-input text-area" value={draft.description} onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: { ...draft, description: event.target.value } }))} />
                      </div>
                      <div className="hero-actions">
                        <button className="primary-button compact" type="button" onClick={() => saveItem(item)}>Save</button>
                        <button className="secondary-button compact" type="button" onClick={() => removeItem(item.id)}>Delete</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </section>

      <aside className="inspector-panel">
        <section className="summary-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">Selected order</p>
              <h3>{currentOrder ? currentOrder.id.slice(0, 8) : "No order selected"}</h3>
            </div>
          </div>

          {currentOrder ? (
            <>
              <button className="order-focus-card" type="button" onClick={() => setIsSelectedOrderOpen((current) => !current)}>
                <div className="order-focus-summary">
                  <div className="order-focus-meta">
                    <span>Order #{currentOrder.id.slice(0, 8)}</span>
                    <strong>{currency.format(currentOrder.total)}</strong>
                  </div>
                  <div className="order-focus-side">
                    <span className={`status-pill ${getStatusTone(currentOrder.status)}`}>
                      {STATUS_LABELS[currentOrder.status]}
                    </span>
                    <span className="toggle-indicator" aria-hidden="true">{isSelectedOrderOpen ? "Hide" : "View"}</span>
                  </div>
                </div>
              </button>
              {isSelectedOrderOpen ? (
                <>
                  <div className="cart-list">
                    {currentOrder.items.map((item) => (
                      <div key={`${currentOrder.id}-${item.id}`} className="cart-item static">
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.quantity} x {currency.format(item.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="status-actions">
                    {ORDER_STATUS_STEPS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`ghost-button ${currentOrder.status === status ? "active" : ""}`}
                        disabled={updatingOrderId === currentOrder.id || currentOrder.status === status}
                        onClick={() => onUpdateOrderStatus(currentOrder.id, status)}
                      >
                        {updatingOrderId === currentOrder.id
                          ? "Updating..."
                          : currentOrder.status === status
                            ? STATUS_LABELS[status]
                            : `Mark ${STATUS_LABELS[status]}`}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
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
                    <strong>Table {call.tableCode}</strong>
                    <span>{new Date(call.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <button className="secondary-button compact" onClick={() => onClearWaiterCall(call.id)}>
                    Clear
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No active waiter requests right now.</p>
          )}
        </section>

        <section className="tracking-panel">
          <div className="section-heading compact-space">
            <div>
              <p className="eyebrow">Table QR</p>
              <h3>Print-ready table links</h3>
            </div>
            <button className="ghost-button" type="button" onClick={() => setIsQrSectionOpen((current) => !current)}>
              {isQrSectionOpen ? "Hide tables" : "View tables"}
            </button>
          </div>
          <div className={`menu-collapse ${isQrSectionOpen ? "open" : ""}`}>
            <div className="menu-collapse-inner">
              {tables.length ? (
                <div className="cart-list qr-list qr-stack">
                  {tables.map((table) => (
                    <div key={table.tableCode} className="qr-card">
                      <button
                        className="order-focus-card qr-toggle"
                        type="button"
                        onClick={() => setOpenQrTableCode((current) => (current === table.tableCode ? "" : table.tableCode))}
                      >
                        <div className="order-focus-summary">
                          <div className="order-focus-meta">
                            <span>Table</span>
                            <strong>{table.tableCode}</strong>
                          </div>
                          <div className="order-focus-side">
                            <span className={`status-pill ${table.status === "occupied" ? "tone-preparing" : "tone-served"}`}>
                              {table.status === "occupied" ? "Occupied" : "Free"}
                            </span>
                            <span className="toggle-indicator" aria-hidden="true">
                              {openQrTableCode === table.tableCode ? "Hide" : "View"}
                            </span>
                          </div>
                        </div>
                      </button>
                      {openQrTableCode === table.tableCode ? (
                        <div className="qr-card-body">
                          <div className="cart-item static qr-item">
                            <div>
                              <strong>{table.tableCode} URL</strong>
                              <span>{table.targetUrl}</span>
                            </div>
                            <a className="secondary-link compact" href={table.qrImageUrl} target="_blank" rel="noreferrer">
                              Open QR
                            </a>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">QR links will appear here after the table list loads.</p>
              )}
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default AdminWorkspace;
