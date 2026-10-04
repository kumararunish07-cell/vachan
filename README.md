# Vachan

**The trust layer between a promise and a payment.**

Vachan turns an everyday freelance or small-business promise into a clear, reviewable milestone record: scope, payment signal, proof of work, acceptance/dispute window, and a tamper-evident receipt.

## Why this exists

India has excellent instant payment rails, but the payment itself rarely captures what the money was for, what “done” means, or what evidence should settle a disagreement. Vachan is an India-first prototype for that missing coordination layer.

This repository is a **demo product and production-ready API foundation**, not a bank, escrow service, payment aggregator, or legal-dispute service. It never holds funds. The included UPI flow is explicitly demo-only; the Stripe path is provider-hosted and records payment only from signed webhooks.

## What is included

- Distinctive investor-ready homepage explaining the promise → payment signal → proof loop.
- Interactive agreement workspace with acceptance, disputes, receipt export, and demo-only ₹32,000 Inventory Sync API sample.
- Node.js 20 + Express API with PostgreSQL persistence and an in-memory local fallback.
- scrypt password hashing, short-lived JWT access tokens, and rotating HttpOnly refresh cookies.
- PostgreSQL schema for users, deals, append-only signed events, refresh sessions, and idempotent Stripe webhook receipts.
- HMAC-SHA256 signed timeline with verification on every deal response.
- Stripe Checkout Session endpoint that prices from the stored deal and never handles card fields.
- Stripe webhook signature verification and duplicate event protection.
- Demo-only UPI intent endpoint that never moves funds.
- Docker and Render deployment configuration.
- GitHub Actions checks for syntax, tests, and high-severity dependency vulnerabilities.

## Run locally

```bash
npm install
npm test
npm run dev
```

Then visit <http://localhost:4173> for the UI and <http://localhost:4173/api/health> for the API health check.

For PostgreSQL-backed development:

```bash
docker compose up --build
```

Without `DATABASE_URL`, the API uses an in-memory store for quick demos. Copy `.env.example` to `.env` and use strong local secrets for authenticated API testing.

## Stripe test mode

Stripe is disabled until server-side keys are explicitly configured. For a safe local test:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_APP_URL=http://localhost:4173
```

Use the Stripe CLI to forward signed events to `/api/webhooks/stripe`. The API creates a provider-hosted Checkout Session, and only the verified `checkout.session.completed` webhook marks the payment in the signed timeline. Card data never enters Vachan.

See [`docs/production.md`](docs/production.md) for the complete test-to-live rollout and deployment checklist.

## Core API

- `POST /api/auth/register` — create an account and receive an access token.
- `POST /api/auth/login` — authenticate and rotate the refresh cookie.
- `POST /api/auth/refresh` — rotate the refresh session.
- `POST /api/auth/logout` — revoke the refresh session.
- `GET /api/me` — inspect the authenticated user.
- `POST /api/deals` — create a milestone deal.
- `GET /api/deals` — list deals visible to the authenticated user.
- `GET /api/deals/:id` — return the deal and timeline signature verification results.
- `POST /api/deals/:id/events` — append an allowed event.
- `POST /api/deals/:id/accept` — client/reviewer acceptance shortcut.
- `POST /api/deals/:id/dispute` — append a dispute with a reason.
- `POST /api/payments/intents` — create a demo-only UPI intent event.
- `POST /api/payments/stripe/checkout-sessions` — create a Stripe Checkout Session.
- `POST /api/webhooks/stripe` — verify Stripe events and append payment confirmations.
- `GET /api/health` — deployment health check.

## Repository structure

```text
index.html / app.js / styles.css  investor-ready browser experience
server/                           Node.js API, auth, Stripe, event signing, persistence
db/schema.sql                     PostgreSQL schema
tests/                            security, API, and payment configuration checks
docs/production.md                Stripe test/live and deployment runbook
Dockerfile                        production container
docker-compose.yml                local API + PostgreSQL stack
render.yaml                       Render deployment blueprint
.github/workflows/ci.yml           automated checks
```

## Responsible payment boundary

Vachan coordinates evidence around payment rails; it does not hold money. The ₹32,000 Inventory Sync API example is labeled **Demo only** and does not process a payment. No payment credentials or secrets belong in this repository.

## License

MIT
