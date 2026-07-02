const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

async function getBalance() {
  const [sR, gR, cR] = await Promise.all([
    fetch(`${URL}/rest/v1/servicios_cobrados?select=monto`, { headers: hdrs() }),
    fetch(`${URL}/rest/v1/pureza_gastos?select=monto`, { headers: hdrs() }),
    fetch(`${URL}/rest/v1/cortes?select=reparto_emmanuel,reparto_jeebe,fondo_ahorro`, { headers: hdrs() }),
  ]);
  const servicios = await sR.json();
  const gastos    = await gR.json();
  const cortes    = await cR.json();

  const bal = { caja: 0, ahorro: 0 };

  if (Array.isArray(servicios)) {
    for (const s of servicios) bal.caja += Number(s.monto);
  }
  if (Array.isArray(gastos)) {
    for (const g of gastos) bal.caja -= Number(g.monto);
  }
  // Lo repartido en cortes anteriores sale de la caja; lo no repartido se queda.
  if (Array.isArray(cortes)) {
    for (const c of cortes) {
      bal.caja   -= Number(c.reparto_emmanuel || 0);
      bal.caja   -= Number(c.reparto_jeebe     || 0);
      bal.ahorro += Number(c.fondo_ahorro      || 0);
    }
  }
  return bal;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const tipo = req.query?.tipo;

  try {
    // ── Resumen ────────────────────────────────────────────────
    if (req.method === 'GET' && tipo === 'resumen') {
      const [balance, sR, gR] = await Promise.all([
        getBalance(),
        fetch(`${URL}/rest/v1/servicios_cobrados?order=created_at.desc&limit=15`, { headers: hdrs() }),
        fetch(`${URL}/rest/v1/pureza_gastos?order=created_at.desc&limit=15`, { headers: hdrs() }),
      ]);
      const servicios = await sR.json();
      const gastos    = await gR.json();
      return res.json({ balance, servicios: servicios || [], gastos: gastos || [] });
    }

    // ── Ingresos ───────────────────────────────────────────────
    if (tipo === 'ingresos') {
      if (req.method === 'GET') {
        const { fecha_inicio, fecha_fin } = req.query;
        let url = `${URL}/rest/v1/servicios_cobrados?order=fecha.desc,created_at.desc&limit=200`;
        if (fecha_inicio) url += `&fecha=gte.${fecha_inicio}`;
        if (fecha_fin)    url += `&fecha=lte.${fecha_fin}`;
        const r = await fetch(url, { headers: hdrs() });
        return res.json({ ingresos: (await r.json()) || [] });
      }
      if (req.method === 'POST') {
        const { cotizacion_id, folio_cotizacion, cliente_id, cliente_nombre, descripcion, monto, fecha } = req.body || {};
        if (!monto) return res.status(400).json({ error: 'monto requerido' });
        const body = {
          cotizacion_id:    cotizacion_id || null,
          folio_cotizacion: folio_cotizacion || null,
          cliente_id:       cliente_id || null,
          cliente_nombre:   cliente_nombre || null,
          descripcion:      descripcion || null,
          monto:            Number(monto),
          // cobrado_por ya no se rastrea (cuenta única de Pureza).
          // Se manda null explícito: requiere la migración migracion_cuenta_unica.sql
          // (DROP NOT NULL) para no fallar el insert.
          cobrado_por: null,
          fecha: fecha || new Date().toISOString().split('T')[0],
        };
        const r = await fetch(`${URL}/rest/v1/servicios_cobrados`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        const data = await r.json();
        return res.json({ ingreso: Array.isArray(data) ? data[0] : data });
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id requerido' });
        await fetch(`${URL}/rest/v1/servicios_cobrados?id=eq.${id}`, { method: 'DELETE', headers: hdrs() });
        return res.json({ ok: true });
      }
    }

    // ── Gastos ─────────────────────────────────────────────────
    if (tipo === 'gastos') {
      if (req.method === 'GET') {
        const { fecha_inicio, fecha_fin } = req.query;
        let url = `${URL}/rest/v1/pureza_gastos?order=fecha.desc,created_at.desc&limit=200`;
        if (fecha_inicio) url += `&fecha=gte.${fecha_inicio}`;
        if (fecha_fin)    url += `&fecha=lte.${fecha_fin}`;
        const r = await fetch(url, { headers: hdrs() });
        return res.json({ gastos: (await r.json()) || [] });
      }
      if (req.method === 'POST') {
        const { tipo: tipoGasto, descripcion, monto, fecha, comprobante_url } = req.body || {};
        if (!tipoGasto || !monto) return res.status(400).json({ error: 'tipo y monto requeridos' });
        const body = {
          tipo:            tipoGasto,
          descripcion:     descripcion || null,
          monto:           Number(monto),
          // pagado_por ya no se rastrea (cuenta única de Pureza).
          // Se manda null explícito: requiere la migración migracion_cuenta_unica.sql
          // (DROP NOT NULL) para no fallar el insert.
          pagado_por: null,
          comprobante_url: comprobante_url || null,
          fecha: fecha || new Date().toISOString().split('T')[0],
        };
        const r = await fetch(`${URL}/rest/v1/pureza_gastos`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        const data = await r.json();
        return res.json({ gasto: Array.isArray(data) ? data[0] : data });
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id requerido' });
        await fetch(`${URL}/rest/v1/pureza_gastos?id=eq.${id}`, { method: 'DELETE', headers: hdrs() });
        return res.json({ ok: true });
      }
    }

    // ── Cortes ─────────────────────────────────────────────────
    if (tipo === 'cortes') {
      if (req.method === 'GET') {
        const { calcular, fecha_inicio, fecha_fin } = req.query;

        if (calcular && fecha_inicio && fecha_fin) {
          const [sR, gR, trR] = await Promise.all([
            fetch(`${URL}/rest/v1/servicios_cobrados?fecha=gte.${fecha_inicio}&fecha=lte.${fecha_fin}`, { headers: hdrs() }),
            fetch(`${URL}/rest/v1/pureza_gastos?fecha=gte.${fecha_inicio}&fecha=lte.${fecha_fin}`, { headers: hdrs() }),
            fetch(`${URL}/rest/v1/cortes?select=id,fecha_inicio,fecha_fin&fecha_inicio=lte.${fecha_fin}&fecha_fin=gte.${fecha_inicio}`, { headers: hdrs() }),
          ]);
          const servicios  = (await sR.json()) || [];
          const gastos     = (await gR.json()) || [];
          const trData     = await trR.json();
          const traslapes  = Array.isArray(trData) ? trData : [];

          const total_ingresos = servicios.reduce((a, s) => a + Number(s.monto), 0);
          const total_gastos   = gastos.reduce((a, g) => a + Number(g.monto), 0);
          const disponible     = Math.max(0, total_ingresos - total_gastos);
          const perdida        = total_gastos > total_ingresos ? total_gastos - total_ingresos : 0;

          return res.json({
            calculo: {
              fecha_inicio, fecha_fin,
              total_ingresos, total_gastos,
              disponible, perdida,
              traslapes,
            },
          });
        }

        const r = await fetch(`${URL}/rest/v1/cortes?order=created_at.desc&limit=50`, { headers: hdrs() });
        return res.json({ cortes: (await r.json()) || [] });
      }

      if (req.method === 'POST') {
        const c = req.body || {};
        const body = {
          fecha_inicio:      c.fecha_inicio,
          fecha_fin:         c.fecha_fin,
          total_ingresos:    Number(c.total_ingresos)    || 0,
          total_gastos:      Number(c.total_gastos)      || 0,
          ganancia:          Number(c.disponible)        || 0,
          reparto_emmanuel:  Number(c.reparto_emmanuel)  || 0,
          reparto_jeebe:     Number(c.reparto_jeebe)     || 0,
          fondo_ahorro:      Number(c.fondo_ahorro)      || 0,
          notas:             c.notas || null,
        };
        const r = await fetch(`${URL}/rest/v1/cortes`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        const data = await r.json();
        return res.json({ corte: Array.isArray(data) ? data[0] : data });
      }
    }

    res.status(400).json({ error: 'tipo inválido o método no soportado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
