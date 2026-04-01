import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import crypto from "node:crypto";
import QRCode from "qrcode";
import { Server as SocketServer } from "socket.io";
import { createDatabasePool } from "./db.js";
import { config } from "./config.js";
import {
  clearWaiterCall,
  createOrder,
  createMenuItem,
  createRestaurant,
  createWaiterCall,
  getAdminOrders,
  getAdminOrderHistory,
  getAdminMenu,
  getDashboardSummary,
  getLatestOrderForTable,
  getRestaurantMenu,
  getRestaurants,
  getRestaurantTables,
  verifyAdminPasscode,
  deleteMenuItem,
  updateOrderStatus,
  updateMenuItem,
  getRestaurantPublicContext,
  getWaiterCalls,
} from "./platformRepository.js";

const activeAdminTokens = new Map();

function isAllowedOrigin(origin) {
  return !origin || config.clientOrigins.includes(origin);
}

async function bootstrap() {
  const pool = await createDatabasePool();
  const app = express();
  const server = createServer(app);
  const io = new SocketServer(server, {
    cors: {
      origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    },
  });

  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/restaurants", async (_request, response, next) => {
    try {
      response.json(await getRestaurants(pool));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/platform/restaurants", async (request, response, next) => {
    try {
      const restaurant = await createRestaurant(pool, request.body);
      response.status(201).json(restaurant);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/public/restaurants/:restaurantSlug/context/:tableCode", async (request, response, next) => {
    try {
      response.json(await getRestaurantPublicContext(pool, request.params.restaurantSlug, request.params.tableCode));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/public/restaurants/:restaurantSlug/menu", async (request, response, next) => {
    try {
      response.json(await getRestaurantMenu(pool, request.params.restaurantSlug));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/public/restaurants/:restaurantSlug/orders/latest/:tableCode", async (request, response, next) => {
    try {
      response.json(await getLatestOrderForTable(pool, request.params.restaurantSlug, request.params.tableCode));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/public/restaurants/:restaurantSlug/orders", async (request, response, next) => {
    try {
      const order = await createOrder(pool, request.params.restaurantSlug, request.body);
      await emitUpdates(io, pool, request.params.restaurantSlug, order.tableCode);
      response.status(201).json(order);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/public/restaurants/:restaurantSlug/waiter-calls", async (request, response, next) => {
    try {
      await createWaiterCall(pool, request.params.restaurantSlug, request.body.tableCode);
      await emitUpdates(io, pool, request.params.restaurantSlug, request.body.tableCode);
      response.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/public/restaurants/:restaurantSlug/tables/:tableCode/qr", async (request, response, next) => {
    try {
      const restaurantSlug = request.params.restaurantSlug;
      const tableCode = request.params.tableCode;
      const targetUrl = `${config.clientOrigin}/r/${restaurantSlug}/table/${tableCode}`;
      const svg = await QRCode.toString(targetUrl, { type: "svg", margin: 1, width: 320 });
      response.setHeader("Content-Type", "image/svg+xml");
      response.send(svg);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/restaurants/:restaurantSlug/login", async (request, response, next) => {
    try {
      const auth = await verifyAdminPasscode(pool, request.params.restaurantSlug, request.body?.passcode ?? "");
      if (!auth.isValid) {
        response.status(401).json({ message: "Invalid passcode." });
        return;
      }

      const token = crypto.randomUUID();
      activeAdminTokens.set(token, auth.restaurant.slug);
      response.json({ token, restaurant: auth.restaurant });
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/admin/restaurants/:restaurantSlug", (request, response, next) => {
    const token = request.headers.authorization?.replace("Bearer ", "");
    if (!token || activeAdminTokens.get(token) !== request.params.restaurantSlug) {
      response.status(401).json({ message: "Unauthorized." });
      return;
    }
    next();
  });

  app.get("/api/admin/restaurants/:restaurantSlug/orders", async (request, response, next) => {
    try {
      response.json(await getAdminOrders(pool, request.params.restaurantSlug));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/restaurants/:restaurantSlug/orders/history", async (request, response, next) => {
    try {
      response.json(await getAdminOrderHistory(pool, request.params.restaurantSlug));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/restaurants/:restaurantSlug/summary", async (request, response, next) => {
    try {
      response.json(await getDashboardSummary(pool, request.params.restaurantSlug));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/restaurants/:restaurantSlug/waiter-calls", async (request, response, next) => {
    try {
      response.json(await getWaiterCalls(pool, request.params.restaurantSlug));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/restaurants/:restaurantSlug/tables", async (request, response, next) => {
    try {
      response.json(await getRestaurantTables(pool, request.params.restaurantSlug, config.clientOrigin));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/restaurants/:restaurantSlug/menu", async (request, response, next) => {
    try {
      response.json(await getAdminMenu(pool, request.params.restaurantSlug));
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/restaurants/:restaurantSlug/menu", async (request, response, next) => {
    try {
      response.status(201).json(await createMenuItem(pool, request.params.restaurantSlug, request.body));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/restaurants/:restaurantSlug/menu/:menuItemId", async (request, response, next) => {
    try {
      response.json(await updateMenuItem(pool, request.params.restaurantSlug, request.params.menuItemId, request.body));
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/restaurants/:restaurantSlug/menu/:menuItemId", async (request, response, next) => {
    try {
      response.json(await deleteMenuItem(pool, request.params.restaurantSlug, request.params.menuItemId));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/restaurants/:restaurantSlug/orders/:orderId/status", async (request, response, next) => {
    try {
      const order = await updateOrderStatus(pool, request.params.restaurantSlug, request.params.orderId, request.body.status);
      await emitUpdates(io, pool, request.params.restaurantSlug, order.tableCode);
      response.json(order);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/restaurants/:restaurantSlug/waiter-calls/:callId", async (request, response, next) => {
    try {
      io.emit("waiter-calls:updated", {
        restaurantSlug: request.params.restaurantSlug,
        waiterCalls: await clearWaiterCall(pool, request.params.restaurantSlug, request.params.callId),
      });
      io.emit("dashboard:updated", {
        restaurantSlug: request.params.restaurantSlug,
        summary: await getDashboardSummary(pool, request.params.restaurantSlug),
      });
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    response.status(500).json({ message: error.message || "Unexpected server error." });
  });

  server.listen(config.port, () => {
    console.log(`OrderEZ API listening on http://localhost:${config.port}`);
  });
}

async function emitUpdates(io, pool, restaurantSlug, tableCode) {
  io.emit("order:updated", {
    restaurantSlug,
    tableCode,
    latestOrder: await getLatestOrderForTable(pool, restaurantSlug, tableCode),
  });
  io.emit("waiter-calls:updated", {
    restaurantSlug,
    waiterCalls: await getWaiterCalls(pool, restaurantSlug),
  });
  io.emit("dashboard:updated", {
    restaurantSlug,
    summary: await getDashboardSummary(pool, restaurantSlug),
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start OrderEZ API:", error);
  process.exit(1);
});
