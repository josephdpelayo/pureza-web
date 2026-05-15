const BUCKET = 'Galeria Pureza';

module.exports = async (_req, res) => {
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };

  try {
    const r = await fetch(`${baseUrl}/storage/v1/object/list/${encodeURIComponent(BUCKET)}`, {
      method: 'POST', headers,
      body: JSON.stringify({ prefix: '', limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data });

    const images = (Array.isArray(data) ? data : [])
      .filter(f => f.name && f.name !== '.emptyFolderPlaceholder' && !/\.heic$/i.test(f.name))
      .map(f => ({ url: `${baseUrl}/storage/v1/object/public/${encodeURIComponent(BUCKET)}/${encodeURIComponent(f.name)}` }));

    res.setHeader('Cache-Control', 'no-store');
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
