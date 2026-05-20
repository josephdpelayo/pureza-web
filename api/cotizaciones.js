const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

async function nextFolio() {
  const r = await fetch(`${URL}/rest/v1/cotizaciones?select=folio&order=created_at.desc&limit=1`, { headers: hdrs() });
  const data = await r.json();
  if (!Array.isArray(data) || data.length === 0) return 'COT-0001';
  const num = parseInt((data[0].folio || '').replace('COT-', '')) || 0;
  return 'COT-' + String(num + 1).padStart(4, '0');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const { q, id } = req.query || {};
      if (id) {
        const r = await fetch(`${URL}/rest/v1/cotizaciones?id=eq.${id}`, { headers: hdrs() });
        const data = await r.json();
        return res.json({ cotizacion: Array.isArray(data) ? data[0] : data });
      }
      const { socio, desde, hasta } = req.query || {};
      let url = `${URL}/rest/v1/cotizaciones?order=created_at.desc&limit=500`;
      if (q) url += `&or=(folio.ilike.*${encodeURIComponent(q)}*,cliente_nombre.ilike.*${encodeURIComponent(q)}*)`;
      if (socio) url += `&socio=eq.${encodeURIComponent(socio)}`;
      if (desde) url += `&created_at=gte.${encodeURIComponent(desde)}`;
      if (hasta) url += `&created_at=lte.${encodeURIComponent(hasta)}`;
      const r = await fetch(url, { headers: hdrs() });
      const data = await r.json();
      return res.json({ cotizaciones: Array.isArray(data) ? data : [] });
    }

    if (req.method === 'POST') {
      const { cliente_id, cliente_nombre, socio, items, subtotal, descuento, total } = req.body || {};
      if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'items requeridos' });
      const folio = await nextFolio();
      const body = {
        folio,
        cliente_id: cliente_id || null,
        cliente_nombre: cliente_nombre || null,
        socio: socio || null,
        items,
        subtotal: Number(subtotal) || 0,
        descuento: Number(descuento) || 0,
        total: Number(total) || 0,
      };
      const r = await fetch(`${URL}/rest/v1/cotizaciones`, {
        method: 'POST', headers: hdrs(), body: JSON.stringify(body),
      });
      const data = await r.json();
      return res.json({ cotizacion: Array.isArray(data) ? data[0] : data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query || {};
      if (!id) return res.status(400).json({ error: 'id requerido' });
      await fetch(`${URL}/rest/v1/cotizaciones?id=eq.${id}`, { method: 'DELETE', headers: hdrs() });
      return res.json({ ok: true });
    }

    res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
