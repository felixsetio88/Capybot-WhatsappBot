import crypto from 'crypto';

// Secret key for HMAC token signing (can be customized via process.env.JWT_SECRET)
const JWT_SECRET = process.env.JWT_SECRET || 'whatsapp-bot-super-secret-key-2026';

/**
 * Hashes a plaintext password using crypto.scryptSync with random salt
 * @param {string} password
 * @returns {string} salt:hash format
 */
export function hashPassword(password) {
  if (!password) throw new Error('Password is required');
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored salt:hash string
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash) return false;
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    return false;
  }
}

/**
 * Formats a phone number cleanly (removes spaces, +, -, parentheses)
 * @param {string} phone
 * @returns {string}
 */
export function formatPhoneNumber(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^\d]/g, '');
}

/**
 * Creates a signed base64 auth token containing payload & expiration
 * @param {object} payload - e.g. { userId, phoneNumber }
 * @param {number} expiresInMs - Default 30 days
 * @returns {string}
 */
export function createAuthToken(payload, expiresInMs = 30 * 24 * 60 * 60 * 1000) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Date.now() + expiresInMs;
  const data = { ...payload, exp };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(data)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verifies a signed auth token and returns payload if valid & not expired
 * @param {string} token
 * @returns {object|null}
 */
export function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export default {
  hashPassword,
  verifyPassword,
  formatPhoneNumber,
  createAuthToken,
  verifyAuthToken,
};
