const { requireAuth } = require('./_auth');
const Facturapi = require('facturapi').default;
const { FacturapiError } = require('facturapi');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

// Catálogo SAT c_ClaveProdServ / c_ClaveUnidad (CFDI 4.0): servicio de limpieza
// genérico, cotejado contra el catálogo oficial (phpcfdi/resources-sat-catalogs).
const PRODUCT_KEY = '76111500'; // Servicios de limpieza y mantenimiento de edificios generales y de oficinas
const UNIT_KEY = 'E48'; // Unidad de servicio
const FISCAL_FIELDS = ['rfc', 'regimen_fiscal', 'uso_cfdi', 'codigo_postal'];

function facturapiClient() {
  const key = process.env.FACTURAPI_KEY;
  if (!key) throw Object.assign(new Error('FACTURAPI_KEY no configurada'), { status: 500 });
  return new Facturapi(key);
}

async function getCliente(clienteId) {
  if (!clienteId) return null;
  const r = await fetch(`${URL}/rest/v1/clientes?id=eq.${clienteId}`, { headers: hdrs() });
  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

async function getFactura({ id, servicio_cobrado_id, cotizacion_id }) {
  let url = `${URL}/rest/v1/facturas?`;
  if (id) url += `id=eq.${id}`;
  else if (servicio_cobrado_id) url += `servicio_cobrado_id=eq.${servicio_cobrado_id}`;
  else if (cotizacion_id) url += `cotizacion_id=eq.${cotizacion_id}`;
  else return null;
  const r = await fetch(url, { headers: hdrs() });
  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;

  try {
    // ── Descargar PDF/XML o consultar una factura existente ─────
    if (req.method === 'GET') {
      const { id, servicio_cobrado_id, cotizacion_id, file } = req.query || {};

      if (id && file) {
        const factura = await getFactura({ id });
        if (!factura || !factura.facturapi_id) return res.status(404).json({ error: 'Factura no encontrada' });
        const facturapi = facturapiClient();
        try {
          const stream = file === 'xml'
            ? await facturapi.invoices.downloadXml(factura.facturapi_id)
            : await facturapi.invoices.downloadPdf(factura.facturapi_id);
          res.setHeader('Content-Type', file === 'xml' ? 'application/xml' : 'application/pdf');
          return stream.pipe(res);
        } catch (e) {
          const status = e instanceof FacturapiError ? e.status : 502;
          return res.status(status || 502).json({ error: e.message });
        }
      }

      const factura = await getFactura({ id, servicio_cobrado_id, cotizacion_id });
      return res.json({ factura: factura || null });
    }

    if (req.method === 'POST') {
      const action = req.query?.action;
      const body = req.body || {};

      // ── Cancelar una factura ya timbrada ──────────────────────
      if (action === 'cancelar') {
        const { id, motivo } = body;
        if (!id) return res.status(400).json({ error: 'id requerido' });
        const factura = await getFactura({ id });
        if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
        const facturapi = facturapiClient();
        try {
          await facturapi.invoices.cancel(factura.facturapi_id, { motive: motivo || '02' });
        } catch (e) {
          const status = e instanceof FacturapiError ? e.status : 502;
          return res.status(status || 502).json({ error: e.message });
        }
        const r = await fetch(`${URL}/rest/v1/facturas?id=eq.${id}`, {
          method: 'PATCH', headers: hdrs(), body: JSON.stringify({ estado: 'cancelada' }),
        });
        const data = await r.json();
        return res.json({ factura: Array.isArray(data) ? data[0] : data });
      }

      // ── Generar (timbrar) una factura ─────────────────────────
      const { origen, id: sourceId, receptor, forma_pago, guardar } = body;
      if (!['ingreso', 'cotizacion'].includes(origen)) return res.status(400).json({ error: 'origen inválido' });
      if (!sourceId) return res.status(400).json({ error: 'id requerido' });

      let cliente_id, cliente_nombre, total, descripcion, folio;
      if (origen === 'ingreso') {
        const r = await fetch(`${URL}/rest/v1/servicios_cobrados?id=eq.${sourceId}`, { headers: hdrs() });
        const data = await r.json();
        const ingreso = Array.isArray(data) ? data[0] : data;
        if (!ingreso) return res.status(404).json({ error: 'Ingreso no encontrado' });
        cliente_id = ingreso.cliente_id;
        cliente_nombre = ingreso.cliente_nombre;
        total = Number(ingreso.monto);
        descripcion = ingreso.descripcion || 'Servicio de limpieza';
        folio = ingreso.folio_cotizacion;
      } else {
        const r = await fetch(`${URL}/rest/v1/cotizaciones?id=eq.${sourceId}`, { headers: hdrs() });
        const data = await r.json();
        const cot = Array.isArray(data) ? data[0] : data;
        if (!cot) return res.status(404).json({ error: 'Cotización no encontrada' });
        if (!cot.requiere_factura) return res.status(400).json({ error: 'Esta cotización no requiere factura' });
        cliente_id = cot.cliente_id;
        cliente_nombre = cot.cliente_nombre;
        total = Number(cot.total);
        descripcion = 'Servicios de limpieza';
        folio = cot.folio;
      }
      if (!total || total <= 0) return res.status(400).json({ error: 'Monto inválido' });

      const existente = await getFactura(
        origen === 'ingreso' ? { servicio_cobrado_id: sourceId } : { cotizacion_id: sourceId }
      );
      if (existente && existente.estado === 'timbrada') {
        return res.status(409).json({ error: 'Ya existe una factura para este registro', factura: existente });
      }

      const cliente = await getCliente(cliente_id);
      const fiscal = { ...cliente, ...(receptor || {}) };
      const faltantes = FISCAL_FIELDS.filter(f => !fiscal[f]);
      if (!forma_pago) faltantes.push('forma_pago');
      if (faltantes.length) {
        return res.status(422).json({
          error: 'faltan_datos_fiscales',
          faltantes,
          conocido: {
            nombre: fiscal.nombre || cliente_nombre || '',
            rfc: fiscal.rfc || '',
            regimen_fiscal: fiscal.regimen_fiscal || '',
            uso_cfdi: fiscal.uso_cfdi || '',
            codigo_postal: fiscal.codigo_postal || '',
            email_facturacion: fiscal.email_facturacion || '',
          },
        });
      }

      if (receptor && guardar && cliente_id) {
        await fetch(`${URL}/rest/v1/clientes?id=eq.${cliente_id}`, {
          method: 'PATCH', headers: hdrs(),
          body: JSON.stringify({
            rfc: fiscal.rfc, regimen_fiscal: fiscal.regimen_fiscal,
            uso_cfdi: fiscal.uso_cfdi, codigo_postal: fiscal.codigo_postal,
            email_facturacion: fiscal.email_facturacion || null,
            updated_at: new Date().toISOString(),
          }),
        });
      }

      const facturapi = facturapiClient();
      const legalName = String(fiscal.nombre || cliente_nombre || 'Cliente').toUpperCase();
      let invoice;
      try {
        const customer = await facturapi.customers.create({
          legal_name: legalName,
          tax_id: String(fiscal.rfc).trim().toUpperCase(),
          tax_system: fiscal.regimen_fiscal,
          email: fiscal.email_facturacion || undefined,
          address: { zip: fiscal.codigo_postal, country: 'MEX' },
        });
        invoice = await facturapi.invoices.create({
          customer: customer.id,
          payment_form: forma_pago,
          payment_method: 'PUE',
          use: fiscal.uso_cfdi,
          items: [{
            quantity: 1,
            product: {
              description: descripcion + (folio ? ` — ${folio}` : ''),
              product_key: PRODUCT_KEY,
              unit_key: UNIT_KEY,
              price: total,
              tax_included: true,
              taxes: [{ type: 'IVA', factor: 'Tasa', rate: 0.16 }],
            },
          }],
        });
      } catch (e) {
        const status = e instanceof FacturapiError ? e.status : 502;
        return res.status(status || 502).json({ error: e.message || 'Error al timbrar la factura' });
      }

      const facturaBody = {
        origen,
        servicio_cobrado_id: origen === 'ingreso' ? sourceId : null,
        cotizacion_id: origen === 'cotizacion' ? sourceId : null,
        cliente_id: cliente_id || null,
        cliente_nombre: cliente_nombre || legalName,
        receptor_rfc: String(fiscal.rfc).trim().toUpperCase(),
        facturapi_id: invoice.id,
        uuid_fiscal: invoice.uuid,
        serie: invoice.series || null,
        folio: String(invoice.folio_number || ''),
        total: invoice.total,
        estado: 'timbrada',
      };
      const r = await fetch(`${URL}/rest/v1/facturas`, {
        method: 'POST', headers: hdrs(), body: JSON.stringify(facturaBody),
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.json({ factura: Array.isArray(data) ? data[0] : data });
    }

    res.status(405).json({ error: 'Método no permitido' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};
