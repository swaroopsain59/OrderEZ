export const ORDER_STATUS_STEPS = ["pending", "preparing", "served", "paid"];
export const CATEGORY_ORDER = [
  "Gulabji Special",
  "Chai",
  "Shakes and Coolers",
  "Rolls",
  "Maggi & Chaat",
  "Sandwiches",
  "Mini Meals",
];
export const STATUS_LABELS = {
  pending: "Pending",
  preparing: "Preparing",
  served: "Served",
  paid: "Paid",
};

export const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function getStatusTone(status) {
  if (status === "paid") return "tone-paid";
  if (status === "served") return "tone-served";
  if (status === "preparing") return "tone-preparing";
  return "tone-pending";
}

export function calculateOrderTotals(cart) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const gst = Math.round(subtotal * 0.18);
  return { subtotal, gst, total: subtotal + gst };
}

export function readTableNumber() {
  const params = new URLSearchParams(window.location.search);
  const table = params.get("table");
  return table ? table.trim() : "5";
}

export function isAdminRoute() {
  return window.location.pathname.replace(/\/+$/, "") === "/admin";
}
