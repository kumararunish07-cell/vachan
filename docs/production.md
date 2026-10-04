# Vachan production plan

## Architecture

- **Web/API:** Node.js 20 + Express. The API serves the investor-ready homepage and the authenticated product surface today; it can be split into a separate frontend later.
- **Database:** PostgreSQL 16. `db/schema.sql` is idempotent for first boot and adds an append-only Stripe webhook receipt table; use a versioned migration runner before making future schema changes in a long-lived deployment.
- **Auth:** scrypt password hashes, 15-minute HMAC JWT access tokens, and rotating HttpOnly refresh cookies. Passwords and tokens are never logged.
- **Trust timeline:** every deal event is append-only and signed with HMAC-SHA256 over a deterministic canonical payload. The deal endpoint verifies every signature before returning it. Provider-generated payment events use a signed system actor instead of impersonating a user.
- **Payments:** Stripe Checkout is provider-hosted. Vachan creates a Checkout Session from the stored deal amount, redirects the payer to Stripe, and verifies the raw signed webhook body before appending `payment_confirmed`. Vachan never receives card numbers and never trusts the browser redirect as proof of payment.
- **Demo boundary:** `/api/payments/intents` remains a demo-only UPI URI and never moves funds. The homepage labels the ₹32,000 Inventory Sync API record as `₹32,000 · Demo only` with status `Demo`.

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

### Stripe test mode

1. Create Stripe test-mode keys in the Stripe Dashboard. Do not commit them.
2. Set `STRIPE_SECRET_KEY=sk_test_...` and `PUBLIC_APP_URL=http://localhost:4173` in `.env`.
3. Start the app and create an authenticated API-backed deal.
4. Use the Stripe CLI to forward signed events:

```bash
stripe listen --forward-to localhost:4173/api/webhooks/stripe
```

5. Copy the CLI signing secret into `STRIPE_WEBHOOK_SECRET=whsec_...`.
6. Call `POST /api/payments/stripe/checkout-sessions` with a bearer token and `{ "dealId": "..." }`. Open the returned `url`.
7. Use Stripe test payment details on Stripe-hosted Checkout. The app records the payment only after the signed `checkout.session.completed` webhook arrives.

The server returns `503 STRIPE_NOT_CONFIGURED` when Stripe keys are absent. In production, `PUBLIC_APP_URL` must be HTTPS. The browser integration does not collect card information.

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
- `POST /api/payments/stripe/checkout-sessions` — create an authenticated provider-hosted Stripe Checkout Session.
- `POST /api/webhooks/stripe` — verify Stripe signatures, deduplicate event IDs, and append payment events.
- `GET /api/health` — deployment health check including storage and payment mode.

## Render deployment

1. Create a Render Blueprint from `render.yaml`.
2. Confirm the managed PostgreSQL database and Docker web service.
3. Set `CORS_ORIGIN` and `PUBLIC_APP_URL` to the final HTTPS origin.
4. Add `STRIPE_SECRET_KEY=sk_test_...` for staging first and register the exact HTTPS webhook URL `/api/webhooks/stripe` in Stripe.
5. Store the generated `JWT_SECRET`, `EVENT_SIGNING_SECRET`, and `STRIPE_WEBHOOK_SECRET` as private environment variables. Never place them in GitHub, frontend JavaScript, or logs.
6. Run the test-mode checkout and webhook flow end to end. Confirm that a duplicate Stripe event returns `{ "duplicate": true }` and does not create a second timeline event.
7. Only after business, KYC, settlement, refund, dispute, and tax review, replace the server key with a restricted production key and register a production webhook endpoint.
8. Confirm `/api/health`, registration, login, deal creation, Checkout creation, webhook verification, acceptance, rollback, and monitoring before sharing the URL.

## Production hardening checklist

- Use HTTPS everywhere and keep `NODE_ENV=production`.
- Use Stripe restricted keys and separate test/staging/live projects.
- Rotate Stripe keys and webhook secrets through the host’s secret manager; never expose them to the browser.
- Keep Stripe webhook handling on the raw-body route before JSON parsing.
- Keep Stripe event IDs unique in PostgreSQL and monitor failed deliveries.
- Replace the in-process rate limit with a Redis-backed limiter at the edge/API gateway.
- Add email verification, password reset, account lockout, CSRF protection, and audit logging.
- Add PostgreSQL backups, point-in-time recovery, connection pooling, and versioned migrations.
- Add structured logs with request IDs, error monitoring, uptime checks, and alerts.
- Add object storage for evidence files; store only signed metadata and hashes in PostgreSQL.
- Review India-specific payment, escrow, consumer-protection, privacy, and tax obligations with qualified counsel before handling live funds.
