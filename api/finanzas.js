const { requireAuth } = require('./_auth');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;

  const tipo = req.query?.tipo;

  try {
    // ── Resumen ────────────────────────────────────────────────
    if (req.method === 'GET' && tipo === 'resumen') {
      const [balance, sR, gR, mR, gpR] = await Promise.all([
        getBalance(),
        fetch(`${URL}/rest/v1/servicios_cobrados?order=created_at.desc&limit=15`, { headers: hdrs() }),
        fetch(`${URL}/rest/v1/pureza_gastos?order=created_at.desc&limit=15`, { headers: hdrs() }),
        fetch(`${URL}/rest/v1/servicios_cobrados?select=metodo_pago,monto,cobrado_por`, { headers: hdrs() }),
        fetch(`${URL}/rest/v1/pureza_gastos?select=pagado_por,monto`, { headers: hdrs() }),
      ]);
      const servicios   = await sR.json();
      const gastos      = await gR.json();

      const porMetodo = { efectivo: 0, transferencia: 0, facturado: 0, sin_clasificar: 0 };
      // Saldo por socio: cuánto ha cobrado/gastado cada quien, igual que en su Excel
      // personal. No resta lo repartido en cortes (ver getBalance) — es un número
      // distinto y complementario a balance.caja.
      const porSocio = {
        emmanuel: { ingresos: 0, gastos: 0, saldo: 0 },
        jeebe:    { ingresos: 0, gastos: 0, saldo: 0 },
        banco:    { ingresos: 0, gastos: 0, saldo: 0 },
      };
      if (mR.ok) {
        const metodoRows = (await mR.json()) || [];
        if (Array.isArray(metodoRows)) {
          for (const row of metodoRows) {
            const k = row.metodo_pago && porMetodo.hasOwnProperty(row.metodo_pago) ? row.metodo_pago : 'sin_clasificar';
            porMetodo[k] += Number(row.monto);
            if (row.cobrado_por && porSocio.hasOwnProperty(row.cobrado_por)) {
              porSocio[row.cobrado_por].ingresos += Number(row.monto);
            }
          }
        }
      }
      if (gpR.ok) {
        const gastoRows = (await gpR.json()) || [];
        if (Array.isArray(gastoRows)) {
          for (const row of gastoRows) {
            if (row.pagado_por && porSocio.hasOwnProperty(row.pagado_por)) {
              porSocio[row.pagado_por].gastos += Number(row.monto);
            }
          }
        }
      }
      for (const k of Object.keys(porSocio)) porSocio[k].saldo = porSocio[k].ingresos - porSocio[k].gastos;

      return res.json({ balance, servicios: servicios || [], gastos: gastos || [], porMetodo, porSocio });
    }

    // ── Ingresos ───────────────────────────────────────────────
    if (tipo === 'ingresos') {
      if (req.method === 'GET') {
        const { fecha_inicio, fecha_fin } = req.query;
        let url = `${URL}/rest/v1/servicios_cobrados?order=fecha.desc,created_at.desc&limit=200`;
        if (fecha_inicio) url += `&fecha=gte.${fecha_inicio}`;
        if (fecha_fin)    url += `&fecha=lte.${fecha_fin}`;
        const r = await fetch(url, { headers: hdrs() });
        const ingresos = (await r.json()) || [];

        // Adjunta la factura (si existe) a cada ingreso facturado, en una sola
        // consulta extra en vez de una por renglón.
        const idsFacturables = ingresos.filter(i => i.metodo_pago === 'facturado').map(i => i.id);
        if (idsFacturables.length) {
          const fr = await fetch(`${URL}/rest/v1/facturas?servicio_cobrado_id=in.(${idsFacturables.join(',')})`, { headers: hdrs() });
          const facturas = (await fr.json()) || [];
          const porId = {};
          if (Array.isArray(facturas)) for (const f of facturas) porId[f.servicio_cobrado_id] = f;
          for (const i of ingresos) if (porId[i.id]) i.factura = porId[i.id];
        }

        return res.json({ ingresos });
      }
      if (req.method === 'POST') {
        const {
          cotizacion_id, folio_cotizacion, cliente_id, cliente_nombre, descripcion, monto, fecha,
          metodo_pago, renovacion_meses, cobrado_por,
        } = req.body || {};
        if (!monto) return res.status(400).json({ error: 'monto requerido' });
        const fechaFinal = fecha || new Date().toISOString().split('T')[0];
        const meses = renovacion_meses ? Number(renovacion_meses) : null;
        let proxima_renovacion = null;
        if (meses) {
          const d = new Date(fechaFinal + 'T00:00:00');
          d.setMonth(d.getMonth() + meses);
          proxima_renovacion = d.toISOString().split('T')[0];
        }
        const body = {
          cotizacion_id:    cotizacion_id || null,
          folio_cotizacion: folio_cotizacion || null,
          cliente_id:       cliente_id || null,
          cliente_nombre:   cliente_nombre || null,
          descripcion:      descripcion || null,
          monto:            Number(monto),
          // Quién cobró (opcional): 'emmanuel' | 'jeebe' | 'banco' | null.
          // Requiere migracion_restaurar_socio.sql para el CHECK; la columna ya
          // acepta null desde migracion_cuenta_unica.sql.
          cobrado_por: cobrado_por || null,
          metodo_pago: metodo_pago || null,
          renovacion_meses: meses,
          proxima_renovacion,
          fecha: fechaFinal,
        };
        let r = await fetch(`${URL}/rest/v1/servicios_cobrados`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        let data = await r.json();
        if (!r.ok && /metodo_pago|renovacion_meses|proxima_renovacion/i.test(JSON.stringify(data))) {
          const fallbackBody = { ...body };
          delete fallbackBody.metodo_pago;
          delete fallbackBody.renovacion_meses;
          delete fallbackBody.proxima_renovacion;
          r = await fetch(`${URL}/rest/v1/servicios_cobrados`, {
            method: 'POST', headers: hdrs(), body: JSON.stringify(fallbackBody),
          });
          data = await r.json();
        }
        if (!r.ok) return res.status(r.status).json(data);
        return res.json({ ingreso: Array.isArray(data) ? data[0] : data });
      }
      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id requerido' });
        await fetch(`${URL}/rest/v1/servicios_cobrados?id=eq.${id}`, { method: 'DELETE', headers: hdrs() });
        return res.json({ ok: true });
      }
      if (req.method === 'PATCH') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'id requerido' });
        await fetch(`${URL}/rest/v1/servicios_cobrados?id=eq.${id}`, {
          method: 'PATCH', headers: hdrs(), body: JSON.stringify({ renovacion_notificada: true }),
        });
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
        const { tipo: tipoGasto, descripcion, monto, fecha, comprobante_url, pagado_por } = req.body || {};
        if (!tipoGasto || !monto) return res.status(400).json({ error: 'tipo y monto requeridos' });
        const body = {
          tipo:            tipoGasto,
          descripcion:     descripcion || null,
          monto:           Number(monto),
          // Quién pagó (opcional): 'emmanuel' | 'jeebe' | 'banco' | null.
          // Requiere migracion_restaurar_socio.sql para el CHECK; la columna ya
          // acepta null desde migracion_cuenta_unica.sql.
          pagado_por: pagado_por || null,
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

          // Desglose por socio: Emmanuel = efectivo, Jeebe = transferencias, igual
          // que el corte que ya se reportan por WhatsApp cada semana.
          const porSocio = {
            emmanuel:       { ingresos: [], gastos: [], total_ingresos: 0, total_gastos: 0, saldo: 0 },
            jeebe:          { ingresos: [], gastos: [], total_ingresos: 0, total_gastos: 0, saldo: 0 },
            banco:          { ingresos: [], gastos: [], total_ingresos: 0, total_gastos: 0, saldo: 0 },
            sin_clasificar: { ingresos: [], gastos: [], total_ingresos: 0, total_gastos: 0, saldo: 0 },
          };
          for (const s of servicios) {
            const k = porSocio[s.cobrado_por] ? s.cobrado_por : 'sin_clasificar';
            porSocio[k].ingresos.push(s);
            porSocio[k].total_ingresos += Number(s.monto);
          }
          for (const g of gastos) {
            const k = porSocio[g.pagado_por] ? g.pagado_por : 'sin_clasificar';
            porSocio[k].gastos.push(g);
            porSocio[k].total_gastos += Number(g.monto);
          }
          for (const k of Object.keys(porSocio)) {
            porSocio[k].saldo = porSocio[k].total_ingresos - porSocio[k].total_gastos;
          }

          return res.json({
            calculo: {
              fecha_inicio, fecha_fin,
              total_ingresos, total_gastos,
              disponible, perdida,
              traslapes,
              por_socio: porSocio,
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
          // Desglose por socio (Emmanuel=efectivo, Jeebe=transferencias) para que
          // el historial de cortes conserve el mismo detalle que hoy se reporta
          // por WhatsApp. Requiere migracion_corte_por_socio.sql.
          ingresos_emmanuel: Number(c.por_socio?.emmanuel?.total_ingresos) || 0,
          gastos_emmanuel:   Number(c.por_socio?.emmanuel?.total_gastos)   || 0,
          ingresos_jeebe:    Number(c.por_socio?.jeebe?.total_ingresos)    || 0,
          gastos_jeebe:      Number(c.por_socio?.jeebe?.total_gastos)      || 0,
          ingresos_banco:    Number(c.por_socio?.banco?.total_ingresos)    || 0,
          gastos_banco:      Number(c.por_socio?.banco?.total_gastos)      || 0,
        };
        let r = await fetch(`${URL}/rest/v1/cortes`, {
          method: 'POST', headers: hdrs(), body: JSON.stringify(body),
        });
        let data = await r.json();
        if (!r.ok && /ingresos_emmanuel|gastos_emmanuel|ingresos_jeebe|gastos_jeebe|ingresos_banco|gastos_banco/i.test(JSON.stringify(data))) {
          // migracion_corte_por_socio.sql no se ha corrido todavía: guarda el
          // corte sin el desglose por socio en vez de fallar.
          const fallbackBody = { ...body };
          delete fallbackBody.ingresos_emmanuel;
          delete fallbackBody.gastos_emmanuel;
          delete fallbackBody.ingresos_jeebe;
          delete fallbackBody.gastos_jeebe;
          delete fallbackBody.ingresos_banco;
          delete fallbackBody.gastos_banco;
          r = await fetch(`${URL}/rest/v1/cortes`, {
            method: 'POST', headers: hdrs(), body: JSON.stringify(fallbackBody),
          });
          data = await r.json();
        }
        if (!r.ok) return res.status(r.status).json(data);
        return res.json({ corte: Array.isArray(data) ? data[0] : data });
      }
    }

    res.status(400).json({ error: 'tipo inválido o método no soportado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
