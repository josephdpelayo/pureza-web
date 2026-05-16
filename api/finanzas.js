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
    fetch(`${URL}/rest/v1/servicios_cobrados?select=cobrado_por,monto`, { headers: hdrs() }),
    fetch(`${URL}/rest/v1/pureza_gastos?select=pagado_por,monto`, { headers: hdrs() }),
    fetch(`${URL}/rest/v1/cortes?select=reparto_emmanuel,reparto_jeebe,fondo_ahorro`, { headers: hdrs() }),
  ]);
  const servicios = await sR.json();
  const gastos    = await gR.json();
  const cortes    = await cR.json();

  const bal = { emmanuel: 0, jeebe: 0, banco: 0, ahorro: 0 };

  if (Array.isArray(servicios)) {
    for (const s of servicios) bal[s.cobrado_por] = (bal[s.cobrado_por] || 0) + Number(s.monto);
  }
  if (Array.isArray(gastos)) {
    for (const g of gastos) bal[g.pagado_por] = (bal[g.pagado_por] || 0) - Number(g.monto);
  }
  if (Array.isArray(cortes)) {
    for (const c of cortes) {
      bal.emmanuel -= Number(c.reparto_emmanuel);
      bal.jeebe    -= Number(c.reparto_jeebe);
      bal.banco    -= Number(c.fondo_ahorro);
      bal.ahorro   += Number(c.fondo_ahorro);
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
        const { cotizacion_id, folio_cotizacion, cliente_id, cliente_nombre, descripcion, monto, cobrado_por, fecha } = req.body || {};
        if (!monto || !cobrado_por) return res.status(400).json({ error: 'monto y cobrado_por requeridos' });
        const body = {
          cotizacion_id:    cotizacion_id || null,
          folio_cotizacion: folio_cotizacion || null,
          cliente_id:       cliente_id || null,
          cliente_nombre:   cliente_nombre || null,
          descripcion:      descripcion || null,
          monto:            Number(monto),
          cobrado_por,
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
        const { tipo: tipoGasto, descripcion, monto, pagado_por, fecha, comprobante_url } = req.body || {};
        if (!tipoGasto || !monto || !pagado_por) return res.status(400).json({ error: 'tipo, monto y pagado_por requeridos' });
        const body = {
          tipo:            tipoGasto,
          descripcion:     descripcion || null,
          monto:           Number(monto),
          pagado_por,
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
          const [sR, gR] = await Promise.all([
            fetch(`${URL}/rest/v1/servicios_cobrados?fecha=gte.${fecha_inicio}&fecha=lte.${fecha_fin}`, { headers: hdrs() }),
            fetch(`${URL}/rest/v1/pureza_gastos?fecha=gte.${fecha_inicio}&fecha=lte.${fecha_fin}`, { headers: hdrs() }),
          ]);
          const servicios = (await sR.json()) || [];
          const gastos    = (await gR.json()) || [];

          const efectivo_emmanuel = servicios.filter(s => s.cobrado_por === 'emmanuel').reduce((a, s) => a + Number(s.monto), 0);
          const efectivo_jeebe    = servicios.filter(s => s.cobrado_por === 'jeebe').reduce((a, s) => a + Number(s.monto), 0);
          const transferencias    = servicios.filter(s => s.cobrado_por === 'banco').reduce((a, s) => a + Number(s.monto), 0);
          const total_ingresos    = efectivo_emmanuel + efectivo_jeebe + transferencias;

          const gastos_emmanuel   = gastos.filter(g => g.pagado_por === 'emmanuel').reduce((a, g) => a + Number(g.monto), 0);
          const gastos_jeebe      = gastos.filter(g => g.pagado_por === 'jeebe').reduce((a, g) => a + Number(g.monto), 0);
          const gastos_banco      = gastos.filter(g => g.pagado_por === 'banco').reduce((a, g) => a + Number(g.monto), 0);
          const total_gastos      = gastos_emmanuel + gastos_jeebe + gastos_banco;
          const disponible        = Math.max(0, total_ingresos - total_gastos);

          return res.json({
            calculo: {
              fecha_inicio, fecha_fin,
              efectivo_emmanuel, efectivo_jeebe, transferencias, total_ingresos,
              gastos_emmanuel, gastos_jeebe, gastos_banco, total_gastos,
              disponible,
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
          efectivo_emmanuel: Number(c.efectivo_emmanuel) || 0,
          efectivo_jeebe:    Number(c.efectivo_jeebe)    || 0,
          transferencias:    Number(c.transferencias)    || 0,
          total_ingresos:    Number(c.total_ingresos)    || 0,
          gastos_emmanuel:   Number(c.gastos_emmanuel)   || 0,
          gastos_jeebe:      Number(c.gastos_jeebe)      || 0,
          gastos_banco:      Number(c.gastos_banco)      || 0,
          total_gastos:      Number(c.total_gastos)      || 0,
          ganancia:          Number(c.disponible)        || 0,
          reparto_emmanuel:  Number(c.reparto_emmanuel)  || 0,
          reparto_jeebe:     Number(c.reparto_jeebe)     || 0,
          fondo_ahorro:      Number(c.fondo_ahorro)      || 0,
          caja_chica:        Number(c.caja_chica)        || 0,
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
