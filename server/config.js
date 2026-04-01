import "dotenv/config";

function createClientOrigins(clientOrigin) {
  const origins = new Set([clientOrigin]);

  try {
    const url = new URL(clientOrigin);
    if (url.hostname === "localhost") {
      origins.add(`${url.protocol}//127.0.0.1:${url.port}`);
    }
    if (url.hostname === "127.0.0.1") {
      origins.add(`${url.protocol}//localhost:${url.port}`);
    }
  } catch {
    // Keep the configured origin as-is if parsing fails.
  }

  return [...origins];
}

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin,
  clientOrigins: createClientOrigins(clientOrigin),
  adminPasscode: process.env.ADMIN_PASSCODE ?? "1234",
  db: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "orderez",
  },
};
