# Vachan production plan

## Architecture

- **API:** Node.js 20 + Express. The API serves the static demo today and can be split into a separate frontend later.
- **Database:** PostgreSQL 16. `db/schema.sql` is idempotent for a first deployment; use a migration runner before making schema changes in a long-lived production environment.
- **Auth:** scrypt password hashes, 15-minute HMAC JWT access tokens, and rotating HttpOnly refresh cookies. Passwords and tokens are never logged.
- **Trust timeline:** every deal event is append-only and signed with HMAC-SHA256 over a deterministic canonical payload. The deal endpoint verifies every signature before returning it.
- **Payments:** `/api/payments/intents` intentionally returns a demo UPI URI and never moves funds. A real provider adapter must be added only after a licensed payment partner, KYC, settlement, refund, and dispute process are confirmed.

## Local setup

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Without `DATABASE_URL`, the API uses an in-memory store for quick demos. For PostgreSQL-backed development:

```bash
docker compose up --build
```

## Core API

- `POST /api/auth/register` — create an account and receive an access token.
- `POST /api/auth/login` — authenticate and rotate the refresh cookie.
- `POST /api/auth/refresh` — rotate the refresh session.
- `POST /api/auth/logout` — revoke the refresh session.
- `GET /api/me` — inspect the authenticated user.
- `POST /api/deals` — create a milestone deal.
- `GET /api/deals` — list deals visible to the authenticated user.
- `GET /api/deals/:id` — return the deal and signature verification results for its timeline.
- `POST /api/deals/:id/events` — append an allowed event.
- `POST /api/deals/:id/accept` — client/reviewer acceptance shortcut.
- `POST /api/deals/:id/dispute` — append a dispute with a reason.
- `POST /api/payments/intents` — create a demo-only UPI intent event.
- `GET /api/health` — deployment health check.

## Render deployment

1. Create a Render Blueprint from `render.yaml`.
2. Confirm the managed PostgreSQL database and Docker web service.
3. Set `CORS_ORIGIN` to the final HTTPS frontend/API origin.
4. Keep generated `JWT_SECRET` and `EVENT_SIGNING_SECRET` values private; rotate them with a planned token/session invalidation window.
5. Apply `db/schema.sql` through the first boot, then move to versioned migrations before the first schema change.
6. Confirm `/api/health`, registration, login, deal creation, event verification, and rollback before sharing the URL.

## Production hardening checklist

- Use HTTPS everywhere and keep `NODE_ENV=production`.
- Replace the in-process rate limit with a Redis-backed limiter at the edge/API gateway.
- Add email verification, password reset, account lockout, and audit logging.
- Add CSRF protection if refresh cookies and a cross-site frontend are used.
- Add PostgreSQL backups, point-in-time recovery, connection pooling, and migration checks.
- Add structured logs with request IDs, error monitoring, uptime checks, and alerting.
- Add object storage for evidence files; store only signed metadata and hashes in PostgreSQL.
- Add provider-specific webhook verification and idempotency keys before accepting payment status.
- Review India-specific payment, escrow, consumer-protection, privacy, and tax obligations with qualified counsel before handling live funds.
