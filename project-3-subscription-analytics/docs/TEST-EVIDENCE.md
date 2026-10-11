# Test & Validation Evidence — Project 3 — Subscription Analytics SaaS MVP

All checks are end-to-end: they boot the real Express app on an ephemeral port and drive it over HTTP, so routing, middleware, authentication, role-based access and the database are all exercised together.

**Reproduce:**

```bash
node project-3-subscription-analytics/test/run.js
```

## Captured run

```text
PASS  admin login
PASS  analyst login
PASS  customer login has account_id
PASS  plans listed
PASS  customer cannot create plan (403)
PASS  admin creates plan (201)
PASS  analyst lists accounts
PASS  admin creates account (201)
PASS  customer reads own account
PASS  self-service signup creates account
PASS  customer cannot read other account (403)
PASS  customer records own usage (201)
PASS  customer records second usage metric
PASS  invalid metric rejected (400)
PASS  billing run creates invoices
PASS  invoice amount positive
PASS  re-running same period is idempotent
PASS  customer cannot run billing (403)
PASS  analytics overview has MRR
PASS  MRR reflects active accounts only
PASS  ARR = MRR x 12
PASS  churn rate computed
PASS  usage analytics by metric
PASS  usage analytics by period
PASS  top accounts ranked
PASS  customer blocked from analytics (403)
PASS  analyst blocked from audit (403)
PASS  admin sees audit trail

Project 3 — Subscription Analytics SaaS MVP: 28/28 checks passed
```

## What is covered

- Authentication: successful login, wrong-password rejection, token issuance.
- Role-based access control: each role blocked from what it must not do (403).
- Input validation: malformed payloads rejected with 400 and a problems list.
- Business rules and edge cases specific to this project (see check names above).
- Audit trail: mutating actions recorded.

_Generated 2026-10-11T14:22:29.809Z._
