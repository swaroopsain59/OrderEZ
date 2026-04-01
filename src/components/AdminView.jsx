import { currency, getStatusTone, ORDER_STATUS_STEPS, STATUS_LABELS } from "../format";

function AdminView({
  onClearWaiterCall,
  onSelectOrder,
  onUpdateOrderStatus,
  orders,
  selectedOrder,
  summary,
  tables,
  waiterCalls,
}) {
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
          <article className="kpi"><span>Open orders</span><strong>{summary.openOrders}</strong></article>
          <article className="kpi"><span>Orders today</span><strong>{summary.totalOrders}</strong></article>
          <article className="kpi"><span>Waiter calls</span><strong>{summary.waiterCalls}</strong></article>
        </div>

        <div className="orders-list">
          {orders.length ? (
            orders.map((order) => (
              <button
                key={order.id}
                className={`order-row ${selectedOrder?.id === order.id ? "active" : ""}`}
                onClick={() => onSelectOrder(order.id)}
              >
                <div>
                  <strong>{order.id.slice(0, 8)}</strong>
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
              <h3>{selectedOrder ? selectedOrder.id.slice(0, 8) : "No order selected"}</h3>
            </div>
          </div>

          {selectedOrder ? (
            <>
              <div className="bill-card">
                <span>Table {selectedOrder.tableCode}</span>
                <strong>{currency.format(selectedOrder.total)}</strong>
              </div>
              <div className="cart-list">
                {selectedOrder.items.map((item) => (
                  <div key={`${selectedOrder.id}-${item.id}`} className="cart-item static">
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
                    className={`ghost-button ${selectedOrder.status === status ? "active" : ""}`}
                    onClick={() => onUpdateOrderStatus(selectedOrder.id, status)}
                  >
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
          </div>

          {tables.length ? (
            <div className="cart-list qr-list">
              {tables.map((table) => (
                <div key={table.tableCode} className="cart-item static qr-item">
                  <div>
                    <strong>{table.tableCode}</strong>
                    <span>{table.targetUrl}</span>
                  </div>
                  <a className="secondary-link compact" href={table.qrImageUrl} target="_blank" rel="noreferrer">
                    Open QR
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">QR links will appear here after the table list loads.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

export default AdminView;
