# Test & Validation Evidence — Project 2 — Employee Service Request System

All checks are end-to-end: they boot the real Express app on an ephemeral port and drive it over HTTP, so routing, middleware, authentication, role-based access and the database are all exercised together.

**Reproduce:**

```bash
node project-2-employee-service-requests/test/run.js
```

## Captured run

```text
PASS  admin login
PASS  IT agent login
PASS  employee login
PASS  categories listed
PASS  IT SLA is 24h, HR is 48h
PASS  invalid request rejected (400)
PASS  employee raises request (201)
PASS  SLA due date set on creation
PASS  request not yet overdue
PASS  other employee blocked from request (403)
PASS  employee cannot change status (403)
PASS  agent list admin-only (403 for agent)
PASS  admin can list agents
PASS  assigning agent moves status to assigned
PASS  status transition to in_progress
PASS  agent adds comment (201)
PASS  comments visible on request
PASS  resolve sets resolved_at
PASS  dashboard aggregates requests
PASS  dashboard counts by category
PASS  dashboard reports open count
PASS  employee blocked from dashboard (403)
PASS  audit trail recorded actions

Project 2 — Employee Service Request System: 23/23 checks passed
```

## What is covered

- Authentication: successful login, wrong-password rejection, token issuance.
- Role-based access control: each role blocked from what it must not do (403).
- Input validation: malformed payloads rejected with 400 and a problems list.
- Business rules and edge cases specific to this project (see check names above).
- Audit trail: mutating actions recorded.

_Generated 2026-10-11T14:22:29.808Z._
