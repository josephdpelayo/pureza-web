module.exports = async (_req, res) => {
  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' };

  try {
    const [bucketsRes, listRes] = await Promise.all([
      fetch(`${baseUrl}/storage/v1/bucket`, { headers }),
      fetch(`${baseUrl}/storage/v1/object/list/galeria`, {
        method: 'POST', headers,
        body: JSON.stringify({ prefix: '', limit: 100 }),
      }),
    ]);

    const buckets = await bucketsRes.json();
    const files = await listRes.json();

    res.json({ buckets, files, listStatus: listRes.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
