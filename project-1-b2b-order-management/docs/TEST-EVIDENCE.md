# Test & Validation Evidence — Project 1 — B2B Order Management Platform

All checks are end-to-end: they boot the real Express app on an ephemeral port and drive it over HTTP, so routing, middleware, authentication, role-based access and the database are all exercised together.

**Reproduce:**

```bash
node project-1-b2b-order-management/test/run.js
```

## Captured run

```text
PASS  admin login returns token
PASS  seller login succeeds
PASS  buyer login succeeds
PASS  wrong password rejected (401)
PASS  invalid registration rejected (400)
PASS  buyer can list products
PASS  buyer cannot create product (403)
PASS  seller can create product (201)
PASS  out-of-stock item rejected (409)
PASS  add in-stock item to cart
PASS  cart subtotal computed correctly
PASS  over-quantity add rejected (409)
PASS  checkout creates order (201)
PASS  GST computed at 18%
PASS  invoice issued with number
PASS  stock decremented after order
PASS  buyer sees own orders
PASS  other buyer cannot read order (404)
PASS  seller confirms order
PASS  invalid status rejected (400)
PASS  admin stats available
PASS  audit trail recorded actions
PASS  non-admin blocked from audit (403)

Project 1 — B2B Order Management: 23/23 checks passed
```

## What is covered

- Authentication: successful login, wrong-password rejection, token issuance.
- Role-based access control: each role blocked from what it must not do (403).
- Input validation: malformed payloads rejected with 400 and a problems list.
- Business rules and edge cases specific to this project (see check names above).
- Audit trail: mutating actions recorded.

_Generated 2026-10-11T14:22:29.806Z._
