import crypto from 'node:crypto';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function timingSafeStringEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

export function signEvent(event) {
  const secret = process.env.EVENT_SIGNING_SECRET;
  if (!secret) throw new Error('EVENT_SIGNING_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update(canonicalize(event)).digest('base64url');
}

export function verifyEventSignature(event, signature) {
  if (!signature) return false;
  try { return timingSafeStringEqual(signEvent(event), signature); } catch { return false; }
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, digest] = String(stored).split(':');
  if (algorithm !== 'scrypt' || !salt || !digest) return false;
  const derived = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key)));
  return timingSafeStringEqual(Buffer.from(derived).toString('hex'), digest);
}

export function createAccessToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: user.id, email: user.email, role: user.role, iat: now, exp: now + ACCESS_TTL_SECONDS };
  const encodedHeader = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const body = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const [encodedHeader, encodedPayload, signature] = String(token || '').split('.');
  if (!encodedHeader || !encodedPayload || !signature) return null;
  const body = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!timingSafeStringEqual(expected, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (!payload.sub || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function createRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry() {
  return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => part.trim().split('=')) .filter(([key, value]) => key && value).map(([key, ...value]) => [key, decodeURIComponent(value.join('='))]));
}

export function refreshCookieOptions() {
  const secure = process.env.NODE_ENV === 'production';
  return [`HttpOnly`, `Path=/api/auth`, `SameSite=${secure ? 'None' : 'Lax'}`, ...(secure ? ['Secure'] : []), `Max-Age=${REFRESH_TTL_DAYS * 24 * 60 * 60}`].join('; ');
}

export function clearRefreshCookieOptions() {
  return `HttpOnly; Path=/api/auth; SameSite=${process.env.NODE_ENV === 'production' ? 'None' : 'Lax'}; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function getBearerToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}
