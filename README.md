# Arrowstack Full Stack Development Internship — Project Submission

**Intern:** Bhargavireddy Enumula
**Programme:** Arrowstack 1-Month Full Stack Development Internship
**Domain:** Full Stack Development · Individual · Mentor-reviewed
**Repository:** three progressive, portfolio-oriented projects built to a shared, professional full-stack standard.

---

## What this is

This repository is the complete submission package for the Arrowstack Full Stack Development
internship. It contains the three projects set out in the assignment handbook, each delivered as a
runnable full-stack application (REST backend + React frontend) with its own documentation, test
evidence and a final presentation.

| # | Project | Type | Backend port | Web port |
|---|---------|------|-------------|----------|
| 1 | [B2B Order Management Platform](project-1-b2b-order-management/README.md) | Foundation / Core | 4001 | 5171 |
| 2 | [Employee Service Request System](project-2-employee-service-requests/README.md) | Intermediate | 4002 | 5172 |
| 3 | [Subscription Analytics SaaS MVP](project-3-subscription-analytics/README.md) | Capstone / Portfolio | 4003 | 5173 |

Each project implements the six core features the handbook requires of every project:
role-based access, REST API integration, a relational database with migrations, validation and
error handling, audit-friendly activity records, and deployment-ready configuration.

## Quick start

Requires Node.js 20+ (tested on v20.20.2).

```bash
# 1. Install backend dependencies (once, from the repo root)
npm install

# 2. Run the full validation suite (all three projects + persistence)
npm test

# 3. Start any backend (each in its own terminal)
npm run start:p1     # B2B Order Management   -> http://localhost:4001
npm run start:p2     # Employee Service Requests -> http://localhost:4002
npm run start:p3     # Subscription Analytics -> http://localhost:4003

# 4. Start the matching frontend (in a second terminal)
cd project-1-b2b-order-management/web && npm install && npm run dev
```

Each backend seeds demo data on first run and prints its listening URL. Demo logins are listed in
each project's README.

## How the projects are structured

```
arrowstack-internship/
├── shared/lib/                 # common backend framework (used by all three projects)
│   ├── db.js                   # relational persistence + migration runner
│   ├── auth.js                 # JWT auth, password hashing, role-based access control
│   ├── audit.js                # append-only activity records
│   ├── validate.js             # declarative input validation
│   ├── http.js                 # consistent JSON error handling
│   └── app.js, testkit.js      # app wiring + HTTP test harness
├── project-1-b2b-order-management/{server,web,docs,test}
├── project-2-employee-service-requests/{server,web,docs,test}
├── project-3-subscription-analytics/{server,web,docs,test}
├── docs/                       # internship-level documentation
│   ├── DECISIONS.md            # architecture & technology decisions, trade-offs
│   ├── WORKLOG.md              # dated work log
│   └── SUBMISSION.md           # deliverables checklist + rubric mapping
└── presentation/               # final presentation (all three projects)
```

Every project reuses the same hardened backend framework so that security, validation, auditing and
error handling behave identically across the portfolio — a deliberate design choice explained in
[docs/DECISIONS.md](docs/DECISIONS.md).

## Validation status

The full suite is green:

| Project | Checks | Result |
|---------|--------|--------|
| Project 1 — B2B Order Management | 23 | 23/23 pass |
| Project 2 — Employee Service Requests | 23 | 23/23 pass |
| Project 3 — Subscription Analytics | 28 | 28/28 pass |
| Persistence / restart | 2 | 2/2 pass |

Run `npm test` to reproduce. Full captured output is in each project's `docs/TEST-EVIDENCE.md`.

## Technology note (important for reviewers)

The handbook's recommended stack is **React/Next.js, Node.js/NestJS, PostgreSQL, JWT, Docker**.
This submission uses that architecture — layered REST API, JWT auth, role-based access, a relational
schema behind SQL migrations, a React (Vite) SPA — but substitutes two components so the package
runs anywhere without a build toolchain or a database server:

- **PostgreSQL → a file-backed relational store behind a thin SQL adapter** (`shared/lib/db.js`).
  The application code is written against ordinary SQL (`CREATE TABLE`, `INSERT`, `SELECT … JOIN`)
  and the adapter is the single swap point to point at PostgreSQL in production.
- **Docker → plain `npm` scripts** so a mentor can run everything with Node alone.

Everything else — JWT, role-based access control, migrations, validation, audit logging, REST
integration — is implemented as specified. The full rationale and the path back to the recommended
stack are in [docs/DECISIONS.md](docs/DECISIONS.md).

---

*Arrowstack — Learn. Build. Grow. · arrowstack.in*
