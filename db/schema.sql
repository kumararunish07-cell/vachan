CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'developer' CHECK (role IN ('client', 'developer', 'reviewer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  criteria TEXT NOT NULL CHECK (char_length(criteria) BETWEEN 3 AND 5000),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'payment_pending', 'in_review', 'accepted', 'disputed', 'closed')),
  client_id UUID NOT NULL REFERENCES users(id),
  developer_id UUID REFERENCES users(id),
  review_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('agreement_created', 'payment_intent_created', 'payment_confirmed', 'proof_submitted', 'accepted', 'disputed', 'review_note')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deal_events ALTER COLUMN actor_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS deals_client_idx ON deals(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deals_developer_idx ON deals(developer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deal_events_timeline_idx ON deal_events(deal_id, created_at ASC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing';
ALTER TABLE stripe_webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS stripe_webhook_events_received_idx ON stripe_webhook_events(received_at DESC);

-- Stripe webhook rows are append-only and deduplicated by Stripe's event ID.
