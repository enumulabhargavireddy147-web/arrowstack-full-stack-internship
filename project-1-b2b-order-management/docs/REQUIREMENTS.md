# Project 1 — Requirements

## 1. Stakeholders

- **Primary stakeholder:** the distributor's operations manager, who needs order visibility and
  stock accuracy.
- **Users:** business buyers (place orders), sellers (manage catalogue & fulfil), admin (oversight).

## 2. Inputs, outputs, constraints

- **Inputs:** user credentials; product records; cart items (product + quantity); order status changes.
- **Outputs:** carts, orders, invoices, stock levels, audit records, stats.
- **Constraints:** role separation enforced server-side; stock may never go negative; amounts to 2 dp;
  GST at 18%.

## 3. Success metrics

- A buyer can go from catalogue to a valid GST invoice with no manual step.
- Stock is decremented exactly by the quantities ordered, never below zero.
- Every privileged action is attributable to an actor via the audit log.
- A mentor can reproduce the whole flow with `npm test`.

## 4. Functional requirements

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| F1 | Register & authenticate users | Login returns a JWT; wrong password → 401 |
| F2 | Role-based access | Buyer blocked from product creation → 403 |
| F3 | Catalogue CRUD | Seller creates product → 201; duplicate SKU → 409 |
| F4 | Cart with stock checks | Add beyond stock → 409; valid add → 201 |
| F5 | Checkout → order + invoice | Order status `pending`; invoice number `INV-…`; GST = 18% |
| F6 | Stock decrement on order | Stock after order = stock − qty |
| F7 | Fulfilment | Seller moves order through `confirmed`/`shipped`/`cancelled`; invalid status → 400 |
| F8 | Tenant isolation | Another buyer reading an order → 404 |
| F9 | Admin oversight | Admin lists users, reads audit log; non-admin → 403 |

## 5. Non-functional requirements

- Consistent JSON error shape (`{ error, problems? }`).
- No secrets in source (env-driven `JWT_SECRET`).
- Migrations are ordered and idempotent (`IF NOT EXISTS`).
- Data survives a process restart (file-backed store).

## 6. Out of scope

- Real payment capture, shipping integrations, multi-currency, tax rules beyond flat GST.
