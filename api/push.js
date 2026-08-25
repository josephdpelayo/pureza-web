const { requireAuth } = require('./_auth');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

// Un solo endpoint para push (Vercel Hobby limita a 12 funciones):
//   GET    /api/push?action=vapid-key  → llave pública VAPID
//   POST   /api/push                   → registra/actualiza una suscripción
//   DELETE /api/push?endpoint=...      → desactiva una suscripción
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;

  try {
    if (req.method === 'GET' && req.query?.action === 'vapid-key') {
      return res.json({ key: process.env.VAPID_PUBLIC_KEY || null });
    }

    if (req.method === 'POST') {
      const { endpoint, keys } = req.body || {};
      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ error: 'suscripción inválida' });
      }
      const r = await fetch(`${URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
        method: 'POST',
        headers: { ...hdrs(), Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: req.headers['user-agent'] || null,
          activo: true,
        }),
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data });
      return res.json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const endpoint = req.query?.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'endpoint requerido' });
      await fetch(`${URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`, {
        method: 'PATCH', headers: hdrs(), body: JSON.stringify({ activo: false }),
      });
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
