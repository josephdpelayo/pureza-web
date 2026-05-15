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
      body: JSON.stringify({ prefix: '', limit: 100 }),
    });

    const data = await r.json();
    res.json({ status: r.status, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
