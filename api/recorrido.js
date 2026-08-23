const { requireAuth } = require('./_auth');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
const SONTERRA    = process.env.ORIGEN_SONTERRA;
const REAL_PACIFICO = process.env.ORIGEN_REAL_PACIFICO;
const TARIFA_KM   = process.env.TARIFA_KM_MXN || '4';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    if (!GOOGLE_KEY || !SONTERRA || !REAL_PACIFICO) {
      return res.status(500).json({ error: 'Faltan variables de entorno: GOOGLE_MAPS_API_KEY, ORIGEN_SONTERRA, ORIGEN_REAL_PACIFICO' });
    }

    const { paradas } = req.body || {};
    const stops = Array.isArray(paradas) ? paradas.filter(p => p && String(p).trim()) : [];
    if (!stops.length) return res.status(400).json({ error: 'Agrega al menos una parada' });

    // Recorrido fijo: Sonterra -> RP -> paradas del día (en orden) -> RP -> Sonterra.
    const waypoints = [REAL_PACIFICO, ...stops, REAL_PACIFICO]
      .map(w => encodeURIComponent(w))
      .join('|');

    const url = `https://maps.googleapis.com/maps/api/directions/json`
      + `?origin=${encodeURIComponent(SONTERRA)}`
      + `&destination=${encodeURIComponent(SONTERRA)}`
      + `&waypoints=${waypoints}`
      + `&units=metric&key=${GOOGLE_KEY}`;

    const r = await fetch(url);
    const data = await r.json();

    if (data.status !== 'OK' || !data.routes || !data.routes.length) {
      return res.status(422).json({ error: 'No se pudo calcular la ruta', detalle: data.status });
    }

    const legs = data.routes[0].legs || [];
    const metros = legs.reduce((sum, leg) => sum + (leg.distance ? leg.distance.value : 0), 0);
    const km = Math.round((metros / 1000) * 10) / 10;
    const tarifa_km = Number(TARIFA_KM);
    const costo = Math.round(km * tarifa_km);

    return res.json({ km, tarifa_km, costo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
