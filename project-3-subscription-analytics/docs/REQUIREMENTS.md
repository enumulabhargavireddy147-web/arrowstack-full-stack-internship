# Project 3 — Requirements

## 1. Stakeholders

- **Primary stakeholder:** the SaaS founder/ops lead, who needs revenue and usage visibility.
- **Users:** customers (self-service), analysts (read-only reporting), admin (control plane).

## 2. Inputs, outputs, constraints

- **Inputs:** plan definitions; account sign-ups; usage records; billing period.
- **Outputs:** account views, usage analytics, invoices/billing events, MRR/ARR/churn.
- **Constraints:** customers isolated to their own account; billing idempotent per period; amounts to 2 dp.

## 3. Success metrics

- MRR/ARR/churn computed correctly from live account state.
- A billing run produces correct invoices including overage, and never duplicates.
- A mentor can reproduce the analytics with `npm test`.

## 4. Functional requirements

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| F1 | Authenticate users | Login returns JWT with role and (for customers) `account_id` |
| F2 | Self-service signup | Registering with an account name creates an account → 201 |
| F3 | Plans | Admin creates plan → 201; customer blocked → 403 |
| F4 | Accounts | Admin creates account; listing available to admin/analyst |
| F5 | Account isolation | Customer reading another account → 403 |
| F6 | Usage ingestion | Valid metric → 201; unknown metric → 400 |
| F7 | Billing run | Invoices = active accounts; amount = base + overage |
| F8 | Billing idempotency | Re-running same period → 0 new invoices |
| F9 | Analytics overview | MRR = Σ active plan price; ARR = MRR×12; churn > 0 |
| F10 | Usage analytics | Aggregated by metric and by period |
| F11 | RBAC | Customer blocked from analytics → 403; analyst blocked from audit → 403 |
| F12 | Audit | Admin-only read; actions recorded |

## 5. Non-functional requirements

- Deterministic, rounded money arithmetic (2 dp).
- Consistent JSON error shape.
- Data survives restart.

## 6. Out of scope

- Real payment gateway, dunning, tax/VAT, invoicing PDFs, multi-currency, forecasting.
