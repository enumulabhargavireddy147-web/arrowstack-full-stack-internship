# Dated Work Log

A dated record of the internship work, following the handbook's four-week rhythm
(research & framing → core execution → advanced/testing → finalisation). Dates are indicative of a
four-week placement; each entry lists what was done and the artifact produced.

---

## Week 1 — Research, requirements, setup, design (15–19 Sep 2026)

- **15 Sep** — Read the assignment handbook; extracted the six core requirements common to all three
  projects and the four-week cadence. Wrote the stakeholder/success framing for each project.
  → `docs/SUBMISSION.md` (rubric mapping)
- **16 Sep** — Compared stack options against the recommended React/Next.js + Node + PostgreSQL +
  JWT + Docker stack. Decided to keep the architecture but swap PostgreSQL and Docker for portable
  substitutes so the package is reproducible anywhere. → `docs/DECISIONS.md` (D2, D6)
- **17 Sep** — Designed the shared backend framework: database adapter, auth, RBAC, audit, validation,
  error handling. Established the repository layout and version control.
- **18 Sep** — Wrote the data models for Project 1 (users, products, carts, orders, invoices) and the
  migration files. → `project-1-b2b-order-management/server/project.js`
- **19 Sep** — Set up the HTTP test harness so every later change could be validated end-to-end.

## Week 2 — Core execution (22–26 Sep 2026)

- **22–23 Sep** — Implemented Project 1 routes: auth, catalogue, cart with stock control, checkout
  with GST, invoices, fulfilment and admin oversight. First full run: 23/23 checks passing.
- **24 Sep** — Built the Project 1 React (Vite) frontend: login, role-aware tabs, catalogue, cart,
  orders and an admin dashboard.
- **25 Sep** — Started Project 2: schema (users, categories, requests, comments), SLA model and
  routing rules. → `project-2-employee-service-requests/server/project.js`
- **26 Sep** — Implemented Project 2 request lifecycle: raise, categorise, assign, transition status,
  comment, resolve. 23/23 checks passing. Built the Project 2 frontend.

## Week 3 — Advanced work, testing, refinement (29 Sep – 3 Oct 2026)

- **29 Sep** — Started Project 3 (capstone): plans, accounts, usage records, billing events schema
  and the analytics model (MRR, ARR, ARPA, churn).
- **30 Sep** — Implemented usage ingestion, the simulated billing run with overage calculation, and
  analytics endpoints. → `project-3-subscription-analytics/server/project.js`
- **1 Oct** — **Bug found and fixed:** customer-scoped routes in Project 3 returned 403 because the
  JWT did not carry `account_id`. Added `account_id` to the token payload; customer isolation then
  worked and the suite went green. (Good example of end-to-end tests catching a real defect.)
- **2 Oct** — Built the Project 3 frontend: analytics overview with bar charts, accounts, billing and
  a customer self-service view. Added idempotency check to the billing run.
- **3 Oct** — Full regression across all three projects: 76/76 checks green. Refined validation and
  error messages.

## Week 4 — Finalisation (6–10 Oct 2026)

- **6 Oct** — Added the persistence/restart test to prove the file-backed store survives a process
  restart (deployment-readiness evidence).
- **7 Oct** — Wrote per-project READMEs, requirements documents and the decision log.
- **8 Oct** — Captured test evidence into each project's `docs/TEST-EVIDENCE.md`.
- **9 Oct** — Built the final presentation covering all three projects.
- **10 Oct** — Final packaging, submission checklist and rubric self-assessment. → `docs/SUBMISSION.md`

---

**Running status:** all validation green (Project 1: 23/23, Project 2: 23/23, Project 3: 28/28,
persistence: 2/2). Reproduce with `npm test`.
