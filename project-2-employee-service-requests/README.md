# Project 2 — Employee Service Request System

**Type:** Intermediate real-world task
**Stack:** Node.js + Express REST API · JWT + RBAC · relational store with SQL migrations · React (Vite) SPA

## Scenario

An internal portal where employees raise **IT / HR / Facilities** requests. Each request is
categorised, routed to an agent, tracked against a category SLA, discussed in comments, and reported
on a service dashboard.

## Roles

| Role | Can do |
|------|--------|
| **employee** | raise requests, track own requests, comment |
| **agent** | see the queue, take/assign work, change status, comment |
| **admin** | everything plus assign agents, list agents, view the full audit log |

## Core features (per the handbook)

- **Role-based access** — employees see only their own requests; agents/admin see the queue.
- **REST API integration** — request/comment/dashboard endpoints consumed by the SPA.
- **Relational database with migrations** — users, categories, requests, comments.
- **Validation & error handling** — e.g. a request description under 10 chars → 400.
- **Audit-friendly activity records** — raise/assign/status/comment actions logged.
- **Deployment-ready configuration** — env-driven port/DB/secret.

## SLA model

Each category carries a default SLA in hours (**IT 24h, HR 48h, Facilities 72h**). On creation the
request gets an `sla_due_at` timestamp; a request is flagged **overdue** if it is still open past
that time. The dashboard surfaces the overdue count.

## Demo logins

| Email | Password | Role |
|-------|----------|------|
| admin@arrowstack.in | Admin@123 | admin |
| agent.it@arrowstack.in | Agent@123 | agent (IT) |
| agent.hr@arrowstack.in | Agent@123 | agent (HR) |
| employee@arrowstack.in | Employee@123 | employee |

## Run it

```bash
npm install
npm run start:p2                 # http://localhost:4002

cd project-2-employee-service-requests/web
npm install && npm run dev       # http://localhost:5172
```

## API summary

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/auth/register` | public | register employee/agent |
| POST | `/api/auth/login` | public | obtain JWT |
| GET | `/api/categories` | any | list categories + SLAs |
| POST | `/api/requests` | any | raise a request |
| GET | `/api/requests` | any (scoped) | list requests (filter `?status=`) |
| GET | `/api/requests/:id` | any (scoped) | request + comments |
| PATCH | `/api/requests/:id` | agent, admin | assign / change status / priority |
| POST | `/api/requests/:id/comments` | any (scoped) | add a comment |
| GET | `/api/dashboard` | agent, admin | counts by status/category, overdue |
| GET | `/api/agents` | admin | list agents |
| GET | `/api/audit` | admin | audit trail |

## Request lifecycle

`open → assigned → in_progress → resolved → closed` (assigning an agent moves an `open` request to
`assigned`; resolving/ closing stamps `resolved_at`).

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Test evidence](docs/TEST-EVIDENCE.md) — 23/23 checks passing

Source: `server/`, `web/`, `test/run.js`.
