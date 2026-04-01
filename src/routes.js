export function parseRoute() {
  const parts = window.location.pathname.split("/").filter(Boolean);

  if (parts[0] === "r" && parts[1] && parts[2] === "table" && parts[3]) {
    return {
      kind: "guest",
      restaurantSlug: parts[1],
      tableCode: parts[3],
    };
  }

  if (parts[0] === "admin" && parts[1]) {
    return {
      kind: "admin",
      restaurantSlug: parts[1],
      tableCode: null,
    };
  }

  if (parts[0] === "admin") {
    return {
      kind: "admin-directory",
      restaurantSlug: null,
      tableCode: null,
    };
  }

  return {
    kind: "directory",
    restaurantSlug: null,
    tableCode: null,
  };
}
