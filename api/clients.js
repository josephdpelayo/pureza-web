const URL  = process.env.SUPABASE_URL;
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS') return res.status(200).end();

  try {
    if(req.method === 'GET') {
      const r = await fetch(`${URL}/rest/v1/clientes?order=nombre.asc&limit=200`, { headers: hdrs() });
      const data = await r.json();
      if(!r.ok) return res.status(500).json({ error: data });
      return res.json({ clients: data });
    }

    if(req.method === 'POST') {
      const { id, nombre, domicilio, telefono } = req.body || {};
      if(!nombre) return res.status(400).json({ error: 'nombre requerido' });

      if(id) {
        const r = await fetch(`${URL}/rest/v1/clientes?id=eq.${id}`, {
          method: 'PATCH', headers: hdrs(),
          body: JSON.stringify({ nombre, domicilio, telefono }),
        });
        const data = await r.json();
        return res.json({ client: Array.isArray(data) ? data[0] : data });
      } else {
        const r = await fetch(`${URL}/rest/v1/clientes`, {
          method: 'POST', headers: hdrs(),
          body: JSON.stringify({ nombre, domicilio, telefono }),
        });
        const data = await r.json();
        return res.json({ client: Array.isArray(data) ? data[0] : data });
      }
    }

    if(req.method === 'DELETE') {
      const id = req.query?.id;
      if(!id) return res.status(400).json({ error: 'id requerido' });
      await fetch(`${URL}/rest/v1/clientes?id=eq.${id}`, { method: 'DELETE', headers: hdrs() });
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Método no permitido' });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
