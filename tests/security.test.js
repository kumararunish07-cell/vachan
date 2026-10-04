import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-jwt-secret-with-enough-entropy';
process.env.EVENT_SIGNING_SECRET = 'test-event-secret-with-enough-entropy';

const { canonicalize, createAccessToken, hashPassword, signEvent, verifyAccessToken, verifyEventSignature, verifyPassword } = await import('../server/security.js');

test('password hashes verify without storing plaintext', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.notEqual(hash, 'correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
});

test('access tokens round-trip and reject tampering', () => {
  const token = createAccessToken({ id: 'user-1', email: 'arunish@example.com', role: 'developer' });
  assert.equal(verifyAccessToken(token).sub, 'user-1');
  const [head, body, signature] = token.split('.');
  const tampered = `${head}.${Buffer.from(JSON.stringify({ sub: 'user-2', exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')}.${signature}`;
  assert.equal(verifyAccessToken(tampered), null);
});

test('event signatures are deterministic, order-independent, and tamper-evident', () => {
  const event = { id: 'event-1', dealId: 'deal-1', actorId: 'user-1', type: 'accepted', payload: { z: 2, a: 1 }, createdAt: '2026-10-04T00:00:00.000Z' };
  const signature = signEvent(event);
  assert.equal(verifyEventSignature(event, signature), true);
  assert.equal(verifyEventSignature({ ...event, payload: { a: 1, z: 2 } }, signature), true);
  assert.equal(verifyEventSignature({ ...event, payload: { a: 1, z: 3 } }, signature), false);
  assert.equal(canonicalize({ b: 2, a: 1 }), '{"a":1,"b":2}');
});
