module.exports = async (_req, res) => {
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const r = await fetch(`${baseUrl}/storage/v1/object/list/galeria`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'apikey': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefix: '', limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
    });

    const data = await r.json();

    if (!r.ok) return res.status(500).json({ error: data });

    const images = (Array.isArray(data) ? data : [])
      .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
      .map(f => ({ url: `${baseUrl}/storage/v1/object/public/galeria/${encodeURIComponent(f.name)}` }));

    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
