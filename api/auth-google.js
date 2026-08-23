const { OAuth2Client } = require('google-auth-library');
const { setSessionCookie, ALLOWED_EMAILS, configured } = require('./_auth');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = CLIENT_ID ? new OAuth2Client(CLIENT_ID) : null;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
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
    res.json({ ok: true, email });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};
