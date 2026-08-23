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
      const { id, detalle, recordatorios } = req.query || {};

      if(recordatorios) {
        const [sR, cR] = await Promise.all([
          fetch(`${URL}/rest/v1/servicios_cobrados?renovacion_meses=not.is.null&order=proxima_renovacion.asc&limit=200`, { headers: hdrs() }),
          fetch(`${URL}/rest/v1/clientes?select=id,nombre,telefono`, { headers: hdrs() }),
        ]);
        const servicios = (await sR.json()) || [];
        const clientesData = (await cR.json()) || [];
        const porId = {};
        if(Array.isArray(clientesData)) for(const c of clientesData) porId[c.id] = c;
        const recs = (Array.isArray(servicios) ? servicios : []).map(s => ({
          id: s.id,
          cliente_id: s.cliente_id,
          cliente_nombre: s.cliente_nombre || (porId[s.cliente_id] && porId[s.cliente_id].nombre) || null,
          telefono: (porId[s.cliente_id] && porId[s.cliente_id].telefono) || null,
          descripcion: s.descripcion,
          proxima_renovacion: s.proxima_renovacion,
          renovacion_notificada: s.renovacion_notificada,
        }));
        return res.json({ recordatorios: recs });
      }

      if(id && detalle) {
        const [cR, qR, sR] = await Promise.all([
          fetch(`${URL}/rest/v1/clientes?id=eq.${id}`, { headers: hdrs() }),
          fetch(`${URL}/rest/v1/cotizaciones?cliente_id=eq.${id}&order=created_at.desc&limit=100`, { headers: hdrs() }),
          fetch(`${URL}/rest/v1/servicios_cobrados?cliente_id=eq.${id}&order=fecha.desc&limit=100`, { headers: hdrs() }),
        ]);
        const [cData, qData, sData] = await Promise.all([cR.json(), qR.json(), sR.json()]);
        const client = Array.isArray(cData) ? cData[0] : cData;
        if(!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        let servicios = Array.isArray(sData) ? sData : [];
        if(client.nombre) {
          const nR = await fetch(`${URL}/rest/v1/servicios_cobrados?cliente_id=is.null&cliente_nombre=eq.${encodeURIComponent(client.nombre)}&order=fecha.desc&limit=100`, { headers: hdrs() });
          const nData = await nR.json();
          if(Array.isArray(nData) && nData.length) servicios = servicios.concat(nData);
        }

        return res.json({ client, cotizaciones: Array.isArray(qData) ? qData : [], servicios });
      }

      const r = await fetch(`${URL}/rest/v1/clientes?order=nombre.asc&limit=200`, { headers: hdrs() });
      const data = await r.json();
      if(!r.ok) return res.status(500).json({ error: data });
      return res.json({ clients: data });
    }

    if(req.method === 'POST') {
      const { id, nombre, domicilio, telefono, notas } = req.body || {};
      if(!nombre) return res.status(400).json({ error: 'nombre requerido' });

      if(id) {
        const r = await fetch(`${URL}/rest/v1/clientes?id=eq.${id}`, {
          method: 'PATCH', headers: hdrs(),
          body: JSON.stringify({ nombre, domicilio, telefono, notas, updated_at: new Date().toISOString() }),
        });
        const data = await r.json();
        return res.json({ client: Array.isArray(data) ? data[0] : data });
      } else {
        const r = await fetch(`${URL}/rest/v1/clientes`, {
          method: 'POST', headers: hdrs(),
          body: JSON.stringify({ nombre, domicilio, telefono, notas }),
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
