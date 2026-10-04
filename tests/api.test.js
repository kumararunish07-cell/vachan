import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.JWT_SECRET = 'test-jwt-secret-with-enough-entropy';
process.env.EVENT_SIGNING_SECRET = 'test-event-secret-with-enough-entropy';
process.env.NODE_ENV = 'test';
process.env.PORT = '0';

const { server } = await import('../server/index.js');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { response, body: await response.json().catch(() => null) };
}

test('health reports the API and storage mode', async () => {
  const { response, body } = await json('/api/health');
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, 'vachan-api');
});

test('register, create a deal, append an event, and verify the timeline signature', async () => {
  const email = `test-${Date.now()}@example.com`;
  const registration = await json('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, displayName: 'Test Client', password: 'password-123', role: 'client' }) });
  assert.equal(registration.response.status, 201);
  const token = registration.body.accessToken;
  const dealResponse = await json('/api/deals', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ title: 'API milestone', criteria: 'A verified test endpoint', amountMinor: 5000 }) });
  assert.equal(dealResponse.response.status, 201);
  const dealId = dealResponse.body.deal.id;
  const eventResponse = await json(`/api/deals/${dealId}/events`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ type: 'proof_submitted', payload: { url: 'https://example.com/build' } }) });
  assert.equal(eventResponse.response.status, 201);
  const timeline = await json(`/api/deals/${dealId}`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(timeline.response.status, 200);
  assert.equal(timeline.body.events.length, 2);
  assert.equal(timeline.body.events.every((event) => event.signatureValid), true);
});

test('protected routes reject anonymous requests', async () => {
  const { response, body } = await json('/api/deals');
  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'UNAUTHENTICATED');
});

test.after(async () => { await new Promise((resolve) => server.close(resolve)); });
