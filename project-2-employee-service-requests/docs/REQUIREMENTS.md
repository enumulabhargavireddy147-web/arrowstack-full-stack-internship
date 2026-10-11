# Project 2 — Requirements

## 1. Stakeholders

- **Primary stakeholder:** the service-desk manager, who needs queue visibility and SLA compliance.
- **Users:** employees (raise/track), agents (handle), admin (oversight & routing).

## 2. Inputs, outputs, constraints

- **Inputs:** request title/description/category/priority; assignments; status changes; comments.
- **Outputs:** requests with status & SLA, comment threads, dashboard aggregates.
- **Constraints:** employees isolated to their own requests; SLA derived from category; status limited
  to the defined lifecycle.

## 3. Success metrics

- Every request is routed and resolved within its category SLA where possible.
- Overdue requests are visible to agents/admin on the dashboard.
- A mentor can reproduce the lifecycle with `npm test`.

## 4. Functional requirements

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| F1 | Authenticate users | Login returns JWT; wrong password → 401 |
| F2 | Categories with SLAs | IT 24h / HR 48h / Facilities 72h |
| F3 | Raise request | Valid → 201 status `open`; too-short description → 400 |
| F4 | SLA on creation | `sla_due_at` set from category |
| F5 | Employee isolation | Other employee reading request → 403 |
| F6 | RBAC | Employee cannot change status → 403 |
| F7 | Assignment | Assigning an agent moves `open` → `assigned` |
| F8 | Status lifecycle | Transitions allowed; resolving sets `resolved_at` |
| F9 | Comments | Authorised user adds comment → 201; visible on request |
| F10 | Dashboard | Totals by status/category, open count, overdue count |
| F11 | Audit | Actions recorded; admin-only to read |

## 5. Non-functional requirements

- Consistent JSON error shape.
- Overdue computed consistently from `sla_due_at` vs now for open statuses.
- Data survives restart.

## 6. Out of scope

- Email/notification delivery, attachments, SLA escalation automation, knowledge base.
