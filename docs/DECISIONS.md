# Architecture & Technology Decisions

This document records the significant decisions made while building the three internship projects,
the alternatives considered, and the trade-offs accepted. It is written so a mentor can review *why*
the solution looks the way it does, not just *what* it does.

## D1 — One shared backend framework, three applications

**Decision.** All three projects share a small backend framework (`shared/lib/`) covering the
database adapter, authentication, role-based access control, auditing, validation and error
handling. Each project supplies only its own schema migrations, seed data and routes.

**Why.** The handbook's six core features (role-based access, REST API, migrations, validation,
audit records, deployment-ready config) are identical across projects; only the domain differs.
Centralising them means the security-critical code is written and reasoned about once, then reused —
the same instinct a professional applies when extracting a service layer rather than copy-pasting it.

**Trade-off.** A shared layer couples the projects. For a portfolio that is a benefit (consistent
quality, less duplicated code); for three genuinely independent codebases it would be a liability.
Given they are one internship submission, consistency wins.

## D2 — PostgreSQL-compatible SQL behind a swappable adapter

**Decision.** Application code issues ordinary SQL and never talks to a driver directly. The only
file that knows which engine runs underneath is `shared/lib/db.js`.

**Why.** The handbook recommends PostgreSQL. In a reviewer's environment there may be no PostgreSQL
server available, and requiring one makes the package harder to reproduce. The adapter lets the same
code run on a zero-install, file-backed relational engine (alasql) here, while keeping the migration
to PostgreSQL a one-file change.

**Path to PostgreSQL.** Replace `db.js` with a `pg`-backed implementation exposing the same
`query/one/runMigrations/save` surface. The SQL used (including `CREATE TABLE`, foreign-key style
references via joins, and parameterised queries) is standard and transfers directly. The migration
files become the same SQL, run through a migration tool such as `node-pg-migrate`.

**Trade-off.** A JSON-file snapshot is not a substitute for a real RDBMS under concurrency. It is
entirely adequate for the single-process, single-user internship workloads and for a mentor running
the tests, and it is honest about what it is (see `docs/DECISIONS.md` D6).

## D3 — JWT bearer auth with role-based access control

**Decision.** Passwords are hashed with bcrypt; sessions are stateless JWT bearer tokens; a
`requireRole(...)` middleware guards every privileged route.

**Why.** JWT is the handbook's stated mechanism and is the standard for stateless REST APIs. RBAC is
enforced at the route boundary, not in the UI, so it holds even if a client is bypassed.

**Note.** The JWT payload carries `sub`, `email`, `role` and (where relevant) `account_id`. Putting
`account_id` in the token is what lets a customer be scoped to exactly their own account without an
extra database round-trip per request.

## D4 — Declarative validation at the edge

**Decision.** Each endpoint declares a schema; a shared `validate()` rejects bad input with HTTP 400
and a machine-readable `problems` array.

**Why.** Consistent, centralised input validation keeps route handlers focused on business logic and
gives the frontend a uniform error shape to render. It also makes the "validation and error handling"
requirement auditable in one place.

## D5 — Append-only audit log

**Decision.** Every mutating action writes one row to `audit_log` (actor, role, action, entity,
timestamp). Admins can read it; nobody can edit it through the API.

**Why.** The handbook explicitly asks for "audit-friendly activity records". A write-through audit
trail is the simplest design that satisfies traceability, and it doubles as evidence for the viva.

## D6 — Honest limitations

- The file-backed store serialises the whole database on each write. Fine for demo/tests; not for
  concurrent production traffic.
- Billing in Project 3 is **simulated** (no real payment gateway), exactly as the handbook frames it.
- Secrets: `JWT_SECRET` defaults to a development value and must be supplied via environment
  variable in any real deployment.
- The React SPAs are Vite development builds; production would add `vite build` output served behind
  the API or a CDN.

## D7 — Testing without a heavyweight framework

**Decision.** Validation is done with a ~60-line HTTP harness (`shared/lib/testkit.js`) that boots
each app on an ephemeral port and drives it over real HTTP, rather than adding Jest/Mocha.

**Why.** The evidence that matters is "does the deployed HTTP surface behave correctly", and driving
the real server exercises routing, middleware, auth and the database together. Zero extra
dependencies keeps the package easy to reproduce.

**Trade-off.** No mocking or coverage instrumentation. For a project of this size, end-to-end HTTP
checks give higher-confidence evidence per line of test code.
