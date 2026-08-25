const { OAuth2Client } = require('google-auth-library');
const {
  setSessionCookie, clearSessionCookie, verify, cookieFrom, configured, ALLOWED_EMAILS,
} = require('./_auth');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

// Un solo endpoint para todo lo de auth (Vercel Hobby limita a 12 funciones):
//   GET  /api/auth?action=check      → estado de la sesión
//   GET  /api/auth?action=client-id  → Client ID público de Google
//   POST /api/auth?action=google     → login (recibe { credential })
//   POST /api/auth?action=logout     → cierra sesión
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action;

  try {
    if (req.method === 'GET' && action === 'check') {
      if (!configured()) return res.json({ configured: false, authenticated: false });
      const session = verify(cookieFrom(req));
      if (!session) return res.status(401).json({ configured: true, authenticated: false });
      return res.json({ configured: true, authenticated: true, email: session.email });
    }

    if (req.method === 'GET' && action === 'client-id') {
      return res.json({ clientId: CLIENT_ID || null });
    }

    if (req.method === 'POST' && action === 'google') {
      if (!configured() || !client) {
        return res.status(500).json({ error: 'Login con Google no configurado todavía' });
      }
      const { credential } = req.body || {};
      if (!credential) return res.status(400).json({ error: 'credential requerido' });

      const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
      const payload = ticket.getPayload();
      const email = String(payload.email || '').toLowerCase();

      if (!payload.email_verified || !ALLOWED_EMAILS.includes(email)) {
        return res.status(403).json({ error: 'Este correo no tiene acceso a Pureza Admin' });
      }

      setSessionCookie(res, email);
      return res.json({ ok: true, email });
    }

    if (req.method === 'POST' && action === 'logout') {
      clearSessionCookie(res);
      return res.json({ ok: true });
    }

    res.status(400).json({ error: 'action inválido' });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};
