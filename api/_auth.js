const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET;
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '')
  .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const SESSION_DAYS = 14;

// El login con Google solo se activa cuando estas 3 env vars están puestas.
// Mientras falten, requireAuth() deja pasar todo sin bloquear — mismo
// comportamiento que la app tenía antes (candado solo en el navegador).
function configured() {
  return Boolean(SESSION_SECRET && ALLOWED_EMAILS.length);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !SESSION_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!ALLOWED_EMAILS.includes(String(payload.email || '').toLowerCase())) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function cookieFrom(req) {
  const raw = req.headers.cookie || '';
  const m = raw.match(/(?:^|;\s*)pureza_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function setSessionCookie(res, email) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * SESSION_DAYS;
  const token = sign({ email: email.toLowerCase(), exp });
  res.setHeader('Set-Cookie',
    `pureza_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * SESSION_DAYS}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'pureza_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
}

// Llamar justo después de manejar OPTIONS en cada endpoint protegido.
// Si regresa null, ya mandó la respuesta 401 y el caller debe hacer `return`.
function requireAuth(req, res) {
  if (!configured()) return { email: null, bypass: true };
  const session = verify(cookieFrom(req));
  if (!session) {
    res.status(401).json({ error: 'no autenticado' });
    return null;
  }
  return session;
}

module.exports = {
  configured, verify, cookieFrom, setSessionCookie, clearSessionCookie, requireAuth, ALLOWED_EMAILS,
};
