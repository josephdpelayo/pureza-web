const { requireAuth } = require('./_auth');
const ExcelJS = require('exceljs');

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
const socioNombre = { emmanuel: 'Emmanuel', jeebe: 'Jeebe' };
const metodoADescripcion = { efectivo: 'EFECTIVO', transferencia: 'SERVICIOS TRANSFERENCIAS', facturado: 'FACTURADO' };

// 'YYYY-MM-DD' → Date a medianoche UTC exacta. new Date(fecha+'T00:00:00') se
// interpreta en hora LOCAL del servidor, así que en cualquier huso al oeste de UTC
// exceljs terminaba guardando la fecha con horas de más (visible al abrir el archivo).
function fechaUTC(fechaStr) {
  const [y, m, d] = fechaStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

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

  if (req.query?.formato === 'xlsx') {
    try { return await exportXlsx(res, req.query || {}); }
    catch (err) { return res.status(500).json({ error: err.message }); }
  }

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

// ── Export XLSX: un sheet por socio, mismo formato que EMMANUEL.xlsx / JEEBE.xlsx ──
async function exportXlsx(res, { desde, hasta, socio }) {
  const socios = socio && socioNombre[socio] ? [socio] : Object.keys(socioNombre);
  const wb = new ExcelJS.Workbook();

  for (const s of socios) {
    let ingUrl = `${URL}/rest/v1/servicios_cobrados?order=fecha.asc&cobrado_por=eq.${s}`;
    let gasUrl = `${URL}/rest/v1/pureza_gastos?order=fecha.asc&pagado_por=eq.${s}`;
    if (desde) { ingUrl += `&fecha=gte.${desde}`; gasUrl += `&fecha=gte.${desde}`; }
    if (hasta) { ingUrl += `&fecha=lte.${hasta}`; gasUrl += `&fecha=lte.${hasta}`; }
    const [iR, gR] = await Promise.all([
      fetch(ingUrl, { headers: hdrs() }),
      fetch(gasUrl, { headers: hdrs() }),
    ]);
    const ingresos = (await iR.json()) || [];
    const gastos    = (await gR.json()) || [];

    const ws = wb.addWorksheet(socioNombre[s]);
    ws.getColumn(1).width = 13; ws.getColumn(2).width = 11; ws.getColumn(3).width = 28; ws.getColumn(4).width = 13;
    ws.getColumn(10).width = 13; ws.getColumn(11).width = 11; ws.getColumn(12).width = 34; ws.getColumn(13).width = 13;

    ws.getCell('A1').value = 'INGRESOS'; ws.getCell('F1').value = 'SALDO'; ws.getCell('J1').value = 'GASTOS';
    ['A1', 'F1', 'J1'].forEach(a => { ws.getCell(a).font = { bold: true, size: 14 }; });

    ws.getCell('A6').value = 'FECHA'; ws.getCell('B6').value = 'MES'; ws.getCell('C6').value = 'DESCRIPCIÓN'; ws.getCell('D6').value = 'VALOR';
    ws.getCell('J6').value = 'FECHA'; ws.getCell('K6').value = 'MES'; ws.getCell('L6').value = 'DESCRIPCIÓN'; ws.getCell('M6').value = 'VALOR';
    ws.getRow(6).font = { bold: true };

    const moneyFmt = '"$"#,##0.00';
    let r = 7;
    for (const i of Array.isArray(ingresos) ? ingresos : []) {
      ws.getCell(`A${r}`).value = fechaUTC(i.fecha);
      ws.getCell(`A${r}`).numFmt = 'dd/mm/yyyy';
      ws.getCell(`B${r}`).value = { formula: `TEXT(A${r},"MMMM")` };
      ws.getCell(`C${r}`).value = metodoADescripcion[i.metodo_pago] || i.descripcion || 'SIN CLASIFICAR';
      ws.getCell(`D${r}`).value = Number(i.monto) || 0;
      ws.getCell(`D${r}`).numFmt = moneyFmt;
      r++;
    }
    const lastIng = r - 1;

    r = 7;
    for (const g of Array.isArray(gastos) ? gastos : []) {
      ws.getCell(`J${r}`).value = fechaUTC(g.fecha);
      ws.getCell(`J${r}`).numFmt = 'dd/mm/yyyy';
      ws.getCell(`K${r}`).value = { formula: `TEXT(J${r},"MMMM")` };
      ws.getCell(`L${r}`).value = g.descripcion || tipoGastoLabel[g.tipo] || g.tipo || '';
      ws.getCell(`M${r}`).value = Number(g.monto) || 0;
      ws.getCell(`M${r}`).numFmt = moneyFmt;
      r++;
    }
    const lastGas = r - 1;

    ws.getCell('A3').value = lastIng >= 7 ? { formula: `SUM(D7:D${lastIng})` } : 0;
    ws.getCell('J3').value = lastGas >= 7 ? { formula: `SUM(M7:M${lastGas})` } : 0;
    ws.getCell('F3').value = { formula: 'A3-J3' };
    ['A3', 'J3', 'F3'].forEach(a => { ws.getCell(a).font = { bold: true, size: 13 }; ws.getCell(a).numFmt = moneyFmt; });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `pureza-finanzas${socio ? '-' + socio : ''}${desde ? '-' + desde : ''}${hasta ? '-a-' + hasta : ''}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(Buffer.from(buffer));
}
