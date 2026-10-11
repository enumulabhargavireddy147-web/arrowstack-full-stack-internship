# Project 1 — B2B Order Management Platform

**Type:** Foundation / Core industry task
**Stack:** Node.js + Express REST API · JWT + RBAC · relational store with SQL migrations · React (Vite) SPA

## Scenario

A simulated distributor sells products to business buyers through a multi-role ordering workflow:
catalogue → cart → checkout → order → invoice, with stock control and admin oversight.

## Roles

| Role | Can do |
|------|--------|
| **buyer** | browse catalogue, manage cart, place orders, view own orders & invoices |
| **seller** | create/update products, view all orders, move orders through fulfilment, view stats |
| **admin** | everything above plus manage users (activate/deactivate) and read the audit log |

## Core features (per the handbook)

- **Role-based access** — enforced server-side with `requireRole`.
- **REST API integration** — JSON REST endpoints consumed by the React SPA.
- **Relational database with migrations** — five versioned migrations (users, products, carts, orders, invoices).
- **Validation & error handling** — declarative schemas; 400/401/403/404/409 responses with clear messages.
- **Audit-friendly activity records** — every mutation written to `audit_log`.
- **Deployment-ready configuration** — `PORT`, `DB_FILE`, `JWT_SECRET` via environment variables.

## Demo logins

| Email | Password | Role |
|-------|----------|------|
| admin@arrowstack.in | Admin@123 | admin |
| seller@arrowstack.in | Seller@123 | seller |
| buyer@arrowstack.in | Buyer@123 | buyer |

## Run it

```bash
# backend (from repo root)
npm install
npm run start:p1            # http://localhost:4001

# frontend (new terminal)
cd project-1-b2b-order-management/web
npm install
npm run dev                 # http://localhost:5171  (proxies /api -> 4001)
```

## API summary

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/auth/register` | public | register a buyer or seller |
| POST | `/api/auth/login` | public | obtain JWT |
| GET | `/api/auth/me` | any | current user |
| GET | `/api/products` | any | list active products |
| POST/PATCH | `/api/products` `/api/products/:id` | seller, admin | manage catalogue |
| GET | `/api/cart` | buyer | view cart |
| POST | `/api/cart/items` | buyer | add item (stock-checked) |
| DELETE | `/api/cart/items/:id` | buyer | remove item |
| POST | `/api/orders` | buyer | checkout cart → order + invoice |
| GET | `/api/orders` `/api/orders/:id` | any (scoped) | view orders |
| PATCH | `/api/orders/:id/status` | seller, admin | fulfil / cancel |
| GET | `/api/invoices` | any (scoped) | list invoices |
| GET/PATCH | `/api/admin/users` `/api/admin/users/:id` | admin | user management |
| GET | `/api/admin/audit` | admin | audit trail |
| GET | `/api/admin/stats` | seller, admin | order & stock stats |

## Business rules

- GST applied at **18%** on the order subtotal; total = subtotal + GST.
- Adding to cart checks available stock; over-quantity adds are rejected (409).
- Checkout decrements stock atomically per line item and issues an invoice (`INV-<year>-<id>`).
- Buyers only ever see their own orders/invoices.

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Test evidence](docs/TEST-EVIDENCE.md) — 23/23 checks passing

Source: `server/` (API), `web/` (React SPA), `test/run.js` (validation scenario).
