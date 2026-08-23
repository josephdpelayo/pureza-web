const { requireAuth } = require('./_auth');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  'Content-Type': 'application/json',
});

const metodoLabel = { efectivo: 'Efectivo', transferencia: 'Transferencia', facturado: 'Facturado' };
const tipoGastoLabel = {
  gasolina: 'Gasolina', productos_quimicos: 'Prod. Químicos',
  publicidad: 'Publicidad', materiales: 'Materiales', otros: 'Otros',
};

function csvField(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csvRow(fields) {
  return fields.map(csvField).join(',') + '\r\n';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;

  try {
    const { desde, hasta } = req.query || {};
    let ingresosUrl = `${URL}/rest/v1/servicios_cobrados?order=fecha.asc`;
    let gastosUrl = `${URL}/rest/v1/pureza_gastos?order=fecha.asc`;
    if (desde) { ingresosUrl += `&fecha=gte.${desde}`; gastosUrl += `&fecha=gte.${desde}`; }
    if (hasta) { ingresosUrl += `&fecha=lte.${hasta}`; gastosUrl += `&fecha=lte.${hasta}`; }

    const [iR, gR] = await Promise.all([
      fetch(ingresosUrl, { headers: hdrs() }),
      fetch(gastosUrl, { headers: hdrs() }),
    ]);
    const ingresos = (await iR.json()) || [];
    const gastos = (await gR.json()) || [];

    const rows = [
      ...(Array.isArray(ingresos) ? ingresos : []).map(i => ({
        fecha: i.fecha, tipo: 'Ingreso',
        descripcion: i.descripcion || '',
        cliente: i.cliente_nombre || '',
        categoria: metodoLabel[i.metodo_pago] || 'Sin clasificar',
        monto: Number(i.monto) || 0,
      })),
      ...(Array.isArray(gastos) ? gastos : []).map(g => ({
        fecha: g.fecha, tipo: 'Gasto',
        descripcion: g.descripcion || '',
        cliente: '',
        categoria: tipoGastoLabel[g.tipo] || g.tipo || '',
        monto: -(Number(g.monto) || 0),
      })),
    ].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    let csv = '﻿';
    csv += csvRow(['Fecha', 'Tipo', 'Descripción', 'Cliente', 'Categoría', 'Monto']);
    for (const r of rows) csv += csvRow([r.fecha, r.tipo, r.descripcion, r.cliente, r.categoria, r.monto]);

    const filename = `pureza-finanzas${desde ? '-' + desde : ''}${hasta ? '-a-' + hasta : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
