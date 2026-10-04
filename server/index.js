import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { createAccessToken, createRefreshToken, getBearerToken, hashPassword, hashRefreshToken, parseCookies, refreshCookieOptions, refreshExpiry, signEvent, verifyAccessToken, verifyEventSignature, verifyPassword, clearRefreshCookieOptions } from './security.js';
import { claimStripeEvent, closeStore, completeStripeEvent, createDeal, createEvent, createUser, findUserByEmail, findUserById, getDeal, getRefreshToken, initStore, listDealsForUser, listEvents, releaseStripeEvent, revokeRefreshToken, saveRefreshToken, storeMode, updateDealStatus } from './store.js';
import { checkoutUrls, constructWebhookEvent, createCheckoutSession, stripeMode } from './stripe.js';

const app = express();
const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT || 4173);
const allowedOrigin = process.env.CORS_ORIGIN || `http://localhost:${port}`;
const validEventTypes = new Set(['agreement_created', 'payment_intent_created', 'payment_confirmed', 'proof_submitted', 'accepted', 'disputed', 'review_note']);
const eventStatus = { payment_confirmed: 'in_review', proof_submitted: 'in_review', accepted: 'accepted', disputed: 'disputed' };

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigin === '*' || origin === allowedOrigin), credentials: true }));

// Stripe requires the exact raw body for signature verification. Keep this route before express.json().
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res, next) => {
  try {
    const event = constructWebhookEvent(req.body, req.headers['stripe-signature']);
    const firstDelivery = await claimStripeEvent(event.id, event.type, event);
    if (!firstDelivery) return res.json({ received: true, duplicate: true });

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const dealId = session.metadata?.dealId || session.client_reference_id;
        const deal = dealId && await getDeal(dealId);
        if (deal && session.payment_status === 'paid') {
          await appendSystemEvent(deal, 'payment_confirmed', {
            provider: 'stripe',
            mode: stripeMode(),
            checkoutSessionId: session.id,
            paymentIntentId: session.payment_intent || null,
            amountMinor: session.amount_total,
            currency: session.currency
          });
        }
      } else if (event.type === 'payment_intent.payment_failed') {
        const intent = event.data.object;
        const dealId = intent.metadata?.dealId;
        const deal = dealId && await getDeal(dealId);
        if (deal) await appendSystemEvent(deal, 'review_note', { provider: 'stripe', status: 'payment_failed', paymentIntentId: intent.id });
      }
      await completeStripeEvent(event.id);
      return res.json({ received: true, duplicate: false });
    } catch (processingError) {
      await releaseStripeEvent(event.id);
      throw processingError;
    }
  } catch (error) {
    if (error.code === 'STRIPE_SIGNATURE_INVALID') return errorResponse(res, 400, 'INVALID_STRIPE_SIGNATURE', error.message);
    if (error.code === 'STRIPE_NOT_CONFIGURED') return errorResponse(res, 503, 'STRIPE_NOT_CONFIGURED', error.message);
    return next(error);
  }
});

app.use(express.json({ limit: '100kb' }));
const publicFiles = ['index.html', 'styles.css', 'app.js', 'api-client.js'];
for (const publicFile of publicFiles) {
  app.get(`/${publicFile}`, (req, res) => res.sendFile(path.join(projectRoot, publicFile)));
}
app.get('/', (req, res) => res.sendFile(path.join(projectRoot, 'index.html')));

function errorResponse(res, status, code, message, details) { return res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } }); }
function requireFields(body, fields) { return fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === ''); }
function publicUser(user) { return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, createdAt: user.createdAt }; }
function amountMinor(value) { const amount = Number(value); return Number.isInteger(amount) && amount > 0 && amount <= 1000000000 ? amount : null; }
function accessFor(deal, user) { return deal && (deal.clientId === user.id || deal.developerId === user.id || user.role === 'reviewer' || user.role === 'admin'); }
function canonicalEvent(event) { return { id: event.id, dealId: event.dealId, actorId: event.actorId, type: event.type, payload: event.payload, createdAt: event.createdAt }; }

async function issueSession(res, user) {
  const refreshToken = createRefreshToken();
  await saveRefreshToken({ userId: user.id, tokenHash: hashRefreshToken(refreshToken), expiresAt: refreshExpiry() });
  res.setHeader('Set-Cookie', `vachan_refresh=${encodeURIComponent(refreshToken)}; ${refreshCookieOptions()}`);
  return { accessToken: createAccessToken(user), user: publicUser(user) };
}

async function authRequired(req, res, next) {
  const payload = verifyAccessToken(getBearerToken(req));
  if (!payload) return errorResponse(res, 401, 'UNAUTHENTICATED', 'A valid access token is required.');
  const user = await findUserById(payload.sub);
  if (!user) return errorResponse(res, 401, 'UNAUTHENTICATED', 'The account no longer exists.');
  req.user = user;
  next();
}

async function appendEvent(deal, user, type, payload = {}) {
  const event = { id: crypto.randomUUID(), dealId: deal.id, actorId: user.id, type, payload, createdAt: new Date().toISOString() };
  event.signature = signEvent(canonicalEvent(event));
  const saved = await createEvent(event);
  if (eventStatus[type]) await updateDealStatus(deal.id, eventStatus[type]);
  return saved;
}

async function appendSystemEvent(deal, type, payload = {}) {
  const event = { id: crypto.randomUUID(), dealId: deal.id, actorId: null, type, payload: { ...payload, actor: 'system' }, createdAt: new Date().toISOString() };
  event.signature = signEvent(canonicalEvent(event));
  const saved = await createEvent(event);
  if (eventStatus[type]) await updateDealStatus(deal.id, eventStatus[type]);
  return saved;
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'vachan-api', version: '2.1.0', storage: storeMode(), payments: stripeMode(), time: new Date().toISOString() }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { email, displayName, password, role = 'developer' } = req.body || {};
    const missing = requireFields(req.body || {}, ['email', 'displayName', 'password']);
    if (missing.length) return errorResponse(res, 400, 'VALIDATION_ERROR', `Missing fields: ${missing.join(', ')}`);
    if (!/^\S+@\S+\.\S+$/.test(String(email))) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Enter a valid email address.');
    if (String(password).length < 8) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Password must contain at least 8 characters.');
    if (!['client', 'developer'].includes(role)) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Role must be client or developer.');
    const user = await createUser({ email: String(email).trim().toLowerCase(), displayName: String(displayName).trim(), passwordHash: await hashPassword(String(password)), role });
    return res.status(201).json(await issueSession(res, user));
  } catch (error) { if (error.code === '23505') return errorResponse(res, 409, 'EMAIL_IN_USE', 'An account with this email already exists.'); next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    return res.json(await issueSession(res, user));
  } catch (error) { next(error); }
});

app.post('/api/auth/refresh', async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const raw = cookies.vachan_refresh;
    const record = raw && await getRefreshToken(hashRefreshToken(raw));
    if (!record || record.revokedAt || new Date(record.expiresAt) <= new Date()) return errorResponse(res, 401, 'INVALID_REFRESH_TOKEN', 'Refresh session is invalid or expired.');
    await revokeRefreshToken(record.tokenHash);
    const user = await findUserById(record.userId);
    if (!user) return errorResponse(res, 401, 'UNAUTHENTICATED', 'The account no longer exists.');
    return res.json(await issueSession(res, user));
  } catch (error) { next(error); }
});

app.post('/api/auth/logout', async (req, res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    if (cookies.vachan_refresh) await revokeRefreshToken(hashRefreshToken(cookies.vachan_refresh));
    res.setHeader('Set-Cookie', `vachan_refresh=; ${clearRefreshCookieOptions()}`);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get('/api/me', authRequired, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/deals', authRequired, async (req, res, next) => {
  try { return res.json({ deals: await listDealsForUser(req.user.id) }); } catch (error) { next(error); }
});

app.post('/api/deals', authRequired, async (req, res, next) => {
  try {
    const { title, criteria, currency = 'INR', developerId = null, reviewDeadline = null } = req.body || {};
    const amount = amountMinor(req.body?.amountMinor);
    const missing = requireFields(req.body || {}, ['title', 'criteria']);
    if (missing.length || !amount) return errorResponse(res, 400, 'VALIDATION_ERROR', 'title, criteria, and a positive integer amountMinor are required.');
    if (String(currency).length !== 3) return errorResponse(res, 400, 'VALIDATION_ERROR', 'currency must be an ISO 4217 code such as INR.');
    const deal = await createDeal({ title: String(title).trim(), criteria: String(criteria).trim(), amountMinor: amount, currency: String(currency).toUpperCase(), status: 'payment_pending', clientId: req.user.id, developerId, reviewDeadline });
    const event = await appendEvent(deal, req.user, 'agreement_created', { title: deal.title, amountMinor: deal.amountMinor, currency: deal.currency });
    return res.status(201).json({ deal, event });
  } catch (error) { next(error); }
});

app.get('/api/deals/:id', authRequired, async (req, res, next) => {
  try {
    const deal = await getDeal(req.params.id);
    if (!deal || !accessFor(deal, req.user)) return errorResponse(res, 404, 'DEAL_NOT_FOUND', 'Deal not found.');
    const events = await listEvents(deal.id);
    const verifiedEvents = events.map((event) => ({ ...event, signatureValid: verifyEventSignature(canonicalEvent(event), event.signature) }));
    return res.json({ deal, events: verifiedEvents });
  } catch (error) { next(error); }
});

app.post('/api/deals/:id/events', authRequired, async (req, res, next) => {
  try {
    const deal = await getDeal(req.params.id);
    if (!deal || !accessFor(deal, req.user)) return errorResponse(res, 404, 'DEAL_NOT_FOUND', 'Deal not found.');
    const { type, payload = {} } = req.body || {};
    if (!validEventTypes.has(type)) return errorResponse(res, 400, 'VALIDATION_ERROR', `type must be one of: ${[...validEventTypes].join(', ')}`);
    if (typeof payload !== 'object' || Array.isArray(payload)) return errorResponse(res, 400, 'VALIDATION_ERROR', 'payload must be a JSON object.');
    const event = await appendEvent(deal, req.user, type, payload);
    return res.status(201).json({ event, deal: await getDeal(deal.id) });
  } catch (error) { next(error); }
});

app.post('/api/deals/:id/accept', authRequired, async (req, res, next) => {
  try {
    const deal = await getDeal(req.params.id);
    if (!deal || !accessFor(deal, req.user)) return errorResponse(res, 404, 'DEAL_NOT_FOUND', 'Deal not found.');
    if (!['client', 'reviewer', 'admin'].includes(req.user.role)) return errorResponse(res, 403, 'FORBIDDEN', 'Only a client or reviewer can accept a milestone.');
    const event = await appendEvent(deal, req.user, 'accepted', { note: String(req.body?.note || 'Milestone accepted').slice(0, 500) });
    return res.json({ deal: await getDeal(deal.id), event });
  } catch (error) { next(error); }
});

app.post('/api/deals/:id/dispute', authRequired, async (req, res, next) => {
  try {
    const deal = await getDeal(req.params.id);
    if (!deal || !accessFor(deal, req.user)) return errorResponse(res, 404, 'DEAL_NOT_FOUND', 'Deal not found.');
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 3) return errorResponse(res, 400, 'VALIDATION_ERROR', 'A dispute reason is required.');
    const event = await appendEvent(deal, req.user, 'disputed', { reason: reason.slice(0, 2000) });
    return res.status(201).json({ deal: await getDeal(deal.id), event });
  } catch (error) { next(error); }
});

app.post('/api/payments/intents', authRequired, async (req, res, next) => {
  try {
    const deal = await getDeal(req.body?.dealId);
    if (!deal || !accessFor(deal, req.user)) return errorResponse(res, 404, 'DEAL_NOT_FOUND', 'Deal not found.');
    const paymentIntentId = `vch_demo_${crypto.randomUUID().replaceAll('-', '')}`;
    const upiUri = `upi://pay?pa=demo@upi&pn=Vachan%20Demo&am=${(deal.amountMinor / 100).toFixed(2)}&cu=${deal.currency}&tn=Vachan-${deal.id.slice(0, 8)}`;
    const event = await appendEvent(deal, req.user, 'payment_intent_created', { paymentIntentId, mode: 'demo', upiUri });
    return res.status(201).json({ mode: 'demo', paymentIntentId, upiUri, event });
  } catch (error) { next(error); }
});

app.post('/api/payments/stripe/checkout-sessions', authRequired, async (req, res, next) => {
  try {
    const deal = await getDeal(req.body?.dealId);
    if (!deal || !accessFor(deal, req.user)) return errorResponse(res, 404, 'DEAL_NOT_FOUND', 'Deal not found.');
    if (deal.currency !== 'INR') return errorResponse(res, 400, 'UNSUPPORTED_CURRENCY', 'Stripe Checkout currently supports INR deals only.');
    const session = await createCheckoutSession({ deal, user: req.user });
    const event = await appendEvent(deal, req.user, 'payment_intent_created', {
      provider: 'stripe', mode: stripeMode(), checkoutSessionId: session.id, amountMinor: deal.amountMinor, currency: deal.currency
    });
    return res.status(201).json({ provider: 'stripe', mode: stripeMode(), sessionId: session.id, url: session.url, event });
  } catch (error) {
    if (error.code === 'STRIPE_NOT_CONFIGURED') return errorResponse(res, 503, 'STRIPE_NOT_CONFIGURED', error.message);
    next(error);
  }
});

app.post('/api/webhooks/upi', async (req, res, next) => {
  try {
    const signature = req.headers['x-vachan-event-signature'];
    const expected = signEvent(req.body || {});
    if (process.env.DEMO_WEBHOOKS !== 'true' && (!signature || signature !== expected)) return errorResponse(res, 401, 'INVALID_SIGNATURE', 'Webhook signature is invalid.');
    return res.json({ received: true, verified: process.env.DEMO_WEBHOOKS === 'true' ? false : signature === expected });
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => { console.error(error); return errorResponse(res, 500, 'INTERNAL_ERROR', process.env.NODE_ENV === 'production' ? 'Unexpected server error.' : error.message); });

const store = await initStore();
const server = createServer(app);
server.listen(port, () => console.log(`Vachan API listening on http://localhost:${port} (${store.mode})`));

async function shutdown(signal) { console.log(`${signal} received; shutting down`); server.close(async () => { await closeStore(); process.exit(0); }); }
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { app, server };
