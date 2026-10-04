import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
let pool = null;
const memory = { users: new Map(), deals: new Map(), events: new Map(), refreshTokens: new Map(), stripeEvents: new Set() };

export async function initStore() {
  if (!process.env.DATABASE_URL) return { mode: 'memory' };
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, max: 10 });
  const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));
  await pool.query(await readFile(schemaPath, 'utf8'));
  return { mode: 'postgres' };
}

export function storeMode() { return pool ? 'postgres' : 'memory'; }

function memoryUserView(user) { return user ? { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt } : null; }
function pgUser(row) { return row ? { id: row.id, email: row.email, displayName: row.display_name, role: row.role, passwordHash: row.password_hash, createdAt: row.created_at } : null; }
function pgDeal(row) { return row ? { id: row.id, title: row.title, criteria: row.criteria, amountMinor: row.amount_minor, currency: row.currency, status: row.status, clientId: row.client_id, developerId: row.developer_id, reviewDeadline: row.review_deadline, createdAt: row.created_at, updatedAt: row.updated_at } : null; }
function pgEvent(row) { return row ? { id: row.id, dealId: row.deal_id, actorId: row.actor_id, type: row.type, payload: row.payload, signature: row.signature, createdAt: row.created_at } : null; }

export async function findUserByEmail(email) {
  if (!pool) return [...memory.users.values()].find((user) => user.email === email) || null;
  return pgUser((await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0]);
}

export async function findUserById(id) {
  if (!pool) return memoryUserView(memory.users.get(id));
  return pgUser((await pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0]);
}

export async function createUser({ email, displayName, passwordHash, role }) {
  if (!pool) {
    if ([...memory.users.values()].some((user) => user.email === email)) { const error = new Error('Email already registered'); error.code = '23505'; throw error; }
    const user = { id: randomUUID(), email, displayName, passwordHash, role, createdAt: new Date().toISOString() };
    memory.users.set(user.id, user);
    return memoryUserView(user);
  }
  try {
    const result = await pool.query('INSERT INTO users (email, display_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING *', [email, displayName, passwordHash, role]);
    return pgUser(result.rows[0]);
  } catch (error) { if (error.code === '23505') error.message = 'Email already registered'; throw error; }
}

export async function saveRefreshToken({ userId, tokenHash, expiresAt }) {
  if (!pool) { memory.refreshTokens.set(tokenHash, { userId, tokenHash, expiresAt, revokedAt: null }); return; }
  await pool.query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, tokenHash, expiresAt]);
}

export async function getRefreshToken(tokenHash) {
  if (!pool) return memory.refreshTokens.get(tokenHash) || null;
  const row = (await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [tokenHash])).rows[0];
  return row ? { userId: row.user_id, tokenHash: row.token_hash, expiresAt: row.expires_at, revokedAt: row.revoked_at } : null;
}

export async function revokeRefreshToken(tokenHash) {
  if (!pool) { const record = memory.refreshTokens.get(tokenHash); if (record) record.revokedAt = new Date().toISOString(); return; }
  await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [tokenHash]);
}

export async function createDeal(deal) {
  if (!pool) { const value = { ...deal, id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; memory.deals.set(value.id, value); memory.events.set(value.id, []); return value; }
  const result = await pool.query('INSERT INTO deals (title, criteria, amount_minor, currency, status, client_id, developer_id, review_deadline) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *', [deal.title, deal.criteria, deal.amountMinor, deal.currency, deal.status, deal.clientId, deal.developerId || null, deal.reviewDeadline || null]);
  return pgDeal(result.rows[0]);
}

export async function getDeal(id) {
  if (!pool) return memory.deals.get(id) || null;
  return pgDeal((await pool.query('SELECT * FROM deals WHERE id = $1', [id])).rows[0]);
}

export async function listDealsForUser(userId) {
  if (!pool) return [...memory.deals.values()].filter((deal) => deal.clientId === userId || deal.developerId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const result = await pool.query('SELECT * FROM deals WHERE client_id = $1 OR developer_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(pgDeal);
}

export async function updateDealStatus(id, status) {
  if (!pool) { const deal = memory.deals.get(id); if (!deal) return null; deal.status = status; deal.updatedAt = new Date().toISOString(); return deal; }
  return pgDeal((await pool.query('UPDATE deals SET status = $2, updated_at = now() WHERE id = $1 RETURNING *', [id, status])).rows[0]);
}

export async function createEvent(event) {
  if (!pool) { const value = { ...event }; if (!memory.events.has(event.dealId)) memory.events.set(event.dealId, []); memory.events.get(event.dealId).push(value); return value; }
  const result = await pool.query('INSERT INTO deal_events (id, deal_id, actor_id, type, payload, signature, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [event.id, event.dealId, event.actorId, event.type, event.payload, event.signature, event.createdAt]);
  return pgEvent(result.rows[0]);
}

export async function listEvents(dealId) {
  if (!pool) return (memory.events.get(dealId) || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return (await pool.query('SELECT * FROM deal_events WHERE deal_id = $1 ORDER BY created_at ASC', [dealId])).rows.map(pgEvent);
}

export async function claimStripeEvent(eventId, eventType, payload) {
  if (!pool) {
    if (memory.stripeEvents.has(eventId)) return false;
    memory.stripeEvents.add(eventId);
    return true;
  }
  const result = await pool.query('INSERT INTO stripe_webhook_events (event_id, event_type, payload, status) VALUES ($1, $2, $3, $4) ON CONFLICT (event_id) DO NOTHING RETURNING event_id', [eventId, eventType, payload, 'processing']);
  return result.rowCount === 1;
}

export async function completeStripeEvent(eventId) {
  if (!pool) return;
  await pool.query('UPDATE stripe_webhook_events SET status = $2, processed_at = now() WHERE event_id = $1', [eventId, 'processed']);
}

export async function releaseStripeEvent(eventId) {
  if (!pool) { memory.stripeEvents.delete(eventId); return; }
  await pool.query('DELETE FROM stripe_webhook_events WHERE event_id = $1 AND status = $2', [eventId, 'processing']);
}

export async function closeStore() { if (pool) await pool.end(); }
