# OrderEZ

Full-stack multi-tenant QR restaurant ordering app with:

- React + Vite customer and admin interfaces
- Express API
- MySQL persistence
- Socket.io live updates

## Setup

1. Copy `.env.example` to `.env`
2. Fill in your MySQL credentials
3. Install dependencies:

```bash
npm install
```

4. Start backend:

```bash
npm run server
```

5. Start frontend:

```bash
npm run dev
```

Or run both together:

```bash
npm run dev:full
```

6. Build for production:

```bash
npm run build
```

## Routes

- Restaurant directory: `http://localhost:5173/`
- Guest menu: `http://localhost:5173/r/gulab-ji-chai-bani-park/table/T1`
- Admin directory: `http://localhost:5173/admin`
- Restaurant admin: `http://localhost:5173/admin/gulab-ji-chai-bani-park`

## Backend API

- `GET /api/restaurants`
- `POST /api/platform/restaurants`
- `GET /api/public/restaurants/:restaurantSlug/context/:tableCode`
- `GET /api/public/restaurants/:restaurantSlug/menu`
- `GET /api/public/restaurants/:restaurantSlug/orders/latest/:tableCode`
- `POST /api/public/restaurants/:restaurantSlug/orders`
- `POST /api/public/restaurants/:restaurantSlug/orders/:orderId/cancel`
- `POST /api/public/restaurants/:restaurantSlug/waiter-calls`
- `GET /api/public/restaurants/:restaurantSlug/tables/:tableCode/qr`
- `POST /api/admin/restaurants/:restaurantSlug/login`
- `GET /api/admin/restaurants/:restaurantSlug/orders`
- `GET /api/admin/restaurants/:restaurantSlug/orders/history`
- `GET /api/admin/restaurants/:restaurantSlug/summary`
- `GET /api/admin/restaurants/:restaurantSlug/waiter-calls`
- `GET /api/admin/restaurants/:restaurantSlug/tables`
- `PATCH /api/admin/restaurants/:restaurantSlug/orders/:orderId/status`
- `DELETE /api/admin/restaurants/:restaurantSlug/waiter-calls/:callId`
