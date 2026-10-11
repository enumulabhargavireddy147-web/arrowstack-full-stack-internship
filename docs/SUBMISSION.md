# Submission Checklist & Rubric Mapping

## 1. Handbook deliverables → where they live

| Handbook deliverable | Location |
|----------------------|----------|
| Project source files | `project-*/server/`, `project-*/web/`, `shared/lib/` |
| Requirements & implementation documentation | `project-*/docs/REQUIREMENTS.md`, project READMEs, `docs/DECISIONS.md` |
| Test / validation evidence | `project-*/docs/TEST-EVIDENCE.md`, `test/run-all.sh` |
| README / user & technical guide | root `README.md` + each `project-*/README.md` |
| Final presentation / demo | `presentation/` |
| Version-controlled repository / organised folder | this repository tree |
| Dated work log | `docs/WORKLOG.md` |

## 2. Core features — mapping to evidence

Every project implements the six features the handbook requires. The table shows where each is
implemented and how it is proven.

| Core feature | Implementation | Evidence |
|--------------|----------------|----------|
| Role-based access | `shared/lib/auth.js` (`requireRole`) + per-route guards | RBAC checks in every `test/run.js` (e.g. "buyer cannot create product (403)") |
| REST API integration | Express routers per project | 20–25 endpoints per project, exercised by tests |
| Relational DB with migrations | `shared/lib/db.js` + `migrations[]` per project | `_migrations` table; migration ids 001–005 |
| Validation & error handling | `shared/lib/validate.js` + `shared/lib/http.js` | "invalid … rejected (400)" checks |
| Audit-friendly activity records | `shared/lib/audit.js`, `audit_log` table | "audit trail recorded actions" checks |
| Deployment-ready configuration | env-driven `PORT`, `DB_FILE`, `JWT_SECRET`; `npm` scripts | `test/persistence.js` (restart survives) |

## 3. Rubric self-assessment (100 points)

| Criterion | Pts | Self-assessed | Basis |
|-----------|-----|---------------|-------|
| Requirements & domain understanding | 15 | 14 | Each project opens with stakeholder, inputs/outputs, success metrics and acceptance criteria |
| Technical / professional execution | 25 | 23 | Full-stack, layered, RBAC + JWT + migrations + audit; consistent shared framework |
| Quality, accuracy & validation | 20 | 19 | 76 automated end-to-end checks, all green; real bug found & fixed (work log, 1 Oct) |
| Problem-solving & independence | 15 | 14 | Portable stack substitution, SLA model, billing overage logic, idempotency |
| Documentation & reproducibility | 10 | 10 | Root + per-project READMEs, requirements docs, decision log, work log, one-command tests |
| Presentation & communication | 10 | 9 | Final presentation deck covering all three projects |
| Creativity / improvement thinking | 5 | 4 | Shared framework, analytics model, extension roadmap |

*These are the intern's own estimates for reflection; the mentor's rubric is authoritative.*

## 4. Reproducing the submission

```bash
npm install          # backend dependencies
npm test             # 76 checks across all three projects + persistence
npm run start:p1     # then, in another terminal:
cd project-1-b2b-order-management/web && npm install && npm run dev
```

## 5. Known limitations & next improvements

**Limitations**
- File-backed relational store (single-process); not concurrent-safe at production scale.
- Billing is simulated — no real payment gateway (as the handbook frames it).
- `JWT_SECRET` defaults to a development value; must be overridden in deployment.
- Frontends are Vite dev builds, not production-bundled.

**Next improvements (roadmap)**
1. Migrate the adapter to PostgreSQL and run migrations via `node-pg-migrate`.
2. Add a Docker Compose file (API + Postgres + web) for one-command deployment.
3. Add refresh tokens and rate limiting on auth endpoints.
4. Replace the file store's full-database save with incremental writes.
5. Add role-specific dashboards and export (CSV/PDF) for invoices and analytics.

## 6. Viva / interview talking points

- **Problem & success:** e.g. Project 1 reduces manual order handling for a distributor; success =
  a buyer can go from catalogue to a valid GST invoice with stock correctly decremented.
- **Biggest-impact decision:** writing the SQL behind a swappable adapter (D2) — it made the whole
  package reproducible while keeping a clean path to PostgreSQL.
- **How quality was validated:** end-to-end HTTP tests against the real server (auth, RBAC, business
  rules, edge cases), not just unit mocks.
- **Edge cases handled:** insufficient stock, out-of-stock add, duplicate SKU, invalid status,
  cross-tenant access, duplicate billing run (idempotency), bad email/metric.
- **10× scale:** move to PostgreSQL, add indexes and connection pooling, cache analytics, split
  read/write paths, paginate list endpoints.
- **Most independent problem-solving:** diagnosing the missing `account_id` in the JWT from a failing
  customer-isolation test and fixing it at the auth layer.
