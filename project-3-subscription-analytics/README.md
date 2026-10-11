# Project 3 — Subscription Analytics SaaS MVP

**Type:** Capstone / Portfolio task
**Stack:** Node.js + Express REST API · JWT + RBAC · relational store with SQL migrations · React (Vite) SPA with charts · simulated Stripe-like billing

## Scenario

A SaaS control plane that manages **plans**, **customer accounts**, **usage records**, **billing
events** and **business analytics** (MRR, ARR, ARPA, churn).

## Roles

| Role | Can do |
|------|--------|
| **customer** | view own account, record own usage, view own invoices |
| **analyst** | read-only analytics and account lists |
| **admin** | full control: plans, accounts, usage, billing runs, audit |

## Core features (per the handbook)

- **Role-based access** — customers scoped to their own account; analysts read-only; admin full.
- **REST API integration** — plans/accounts/usage/billing/analytics endpoints consumed by the SPA.
- **Relational database with migrations** — users, plans, accounts, usage_records, billing_events.
- **Validation & error handling** — e.g. an unknown usage metric → 400.
- **Audit-friendly activity records** — signups, plan/account/usage/billing actions logged.
- **Deployment-ready configuration** — env-driven port/DB/secret.

## The analytics model

- **MRR** = sum of `price_monthly` across **active** accounts.
- **ARR** = MRR × 12.
- **ARPA** = MRR ÷ active accounts.
- **Churn rate** = cancelled accounts ÷ all accounts.
- **Usage analytics** aggregated by metric and by month (period `YYYY-MM`).

## Simulated billing run

`POST /api/billing/run` generates one `charge` event per active account for a period:
`amount = plan.price_monthly + max(0, usage_units − plan.included_units) × plan.overage_rate`.
The run is **idempotent** — re-running the same period creates no duplicates.

## Demo logins

| Email | Password | Role |
|-------|----------|------|
| admin@arrowstack.in | Admin@123 | admin |
| analyst@arrowstack.in | Analyst@123 | analyst |
| customer@arrowstack.in | Customer@123 | customer (Acme Retail) |

## Run it

```bash
npm install
npm run start:p3                 # http://localhost:4003

cd project-3-subscription-analytics/web
npm install && npm run dev       # http://localhost:5173
```

## API summary

| Method | Path | Access | Purpose |
|--------|------|--------|---------|
| POST | `/api/auth/register` | public | sign up (optionally creates an account) |
| POST | `/api/auth/login` | public | obtain JWT |
| GET | `/api/plans` | any | list plans |
| POST | `/api/plans` | admin | create plan |
| GET | `/api/accounts` | admin, analyst | list accounts |
| POST/PATCH | `/api/accounts` `/api/accounts/:id` | admin | create / change status or plan |
| GET | `/api/accounts/:id` | any (scoped) | account + usage + invoices |
| POST | `/api/usage` | any (scoped) | record usage |
| POST | `/api/billing/run` | admin | run simulated billing (idempotent) |
| GET | `/api/billing/events` | admin, analyst | billing history |
| GET | `/api/analytics/overview` | admin, analyst | MRR/ARR/ARPA/churn |
| GET | `/api/analytics/usage` | admin, analyst | usage by metric & period |
| GET | `/api/analytics/top-accounts` | admin, analyst | accounts ranked by usage |
| GET | `/api/audit` | admin | audit trail |

## Documentation

- [Requirements](docs/REQUIREMENTS.md)
- [Test evidence](docs/TEST-EVIDENCE.md) — 28/28 checks passing

Source: `server/`, `web/`, `test/run.js`.
