# Vachan

**A trust layer for UPI-based work.**

Vachan turns a freelance or small-business promise into a clear, reviewable milestone record: scope, payment intent, proof of work, acceptance/dispute window, and a tamper-evident receipt.

## Why this exists

India has excellent instant payment rails, but the payment itself rarely captures what the money was for, what “done” means, or what evidence should settle a disagreement. Vachan is an India-first prototype for that missing coordination layer.

This repository is a **demo product and production-ready API foundation**, not a bank, escrow service, payment aggregator, or legal-dispute service. It never holds funds. The included UPI flow generates a demo intent and the ledger records signed events.

## What is included

- Premium zero-build browser demo with agreement creation, review, acceptance, dispute, and receipt flows.
- Node.js 20 + Express API with PostgreSQL persistence and an in-memory local fallback.
- scrypt password hashing, short-lived JWT access tokens, and rotating HttpOnly refresh cookies.
- PostgreSQL schema for users, deals, append-only events, and refresh sessions.
- HMAC-SHA256 signed event timeline with verification on every deal response.
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
- `GET /api/health` — deployment health check.

## Repository structure

```text
index.html / app.js / styles.css  polished browser demo
server/                           Node.js API, auth, event signing, persistence
db/schema.sql                     PostgreSQL schema
tests/                            security and API contract tests
docs/production.md                deployment and hardening runbook
Dockerfile                        production container
docker-compose.yml                local API + PostgreSQL stack
render.yaml                       Render deployment blueprint
.github/workflows/ci.yml           automated checks
```

## Production plan

The recommended first deployment is the included Render Blueprint: one Docker web service plus managed PostgreSQL. Set `CORS_ORIGIN` to the final HTTPS origin, keep generated secrets private, and verify `/api/health`, registration, login, deal creation, event verification, and rollback before sharing the URL.

Before handling live funds, add provider-specific signed webhooks and idempotency keys; arrange KYC, settlement, refunds, and disputes with a licensed payment partner; add email verification, password reset, rate limiting, backups, monitoring, versioned migrations, and India-specific legal/privacy/tax review. See [`docs/production.md`](docs/production.md).

## Responsible payment boundary

Vachan coordinates evidence around payment rails; it does not hold money. The included UPI endpoint is explicitly demo mode and uses a non-settling demo handle. No payment credentials or secrets belong in this repository.

## License

MIT
