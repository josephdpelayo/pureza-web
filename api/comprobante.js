const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'pureza-comprobantes';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { base64, filename, contentType } = req.body || {};
    if (!base64 || !filename) return res.status(400).json({ error: 'base64 y filename requeridos' });

    const buffer = Buffer.from(base64, 'base64');
    const ext    = (contentType === 'image/png') ? 'png' : 'jpg';
    const path   = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const r = await fetch(`${URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        'Content-Type': contentType || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: buffer,
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: err });
    }

    const url = `${URL}/storage/v1/object/public/${BUCKET}/${path}`;
    return res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
