const webpush = require('web-push');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hdrs = () => ({
  Authorization: `Bearer ${KEY}`,
  apikey: KEY,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
});

module.exports = async (req, res) => {
  const auth = req.headers['authorization'] || '';
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'no autorizado' });
  }

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );

    const hoy = new Date().toISOString().split('T')[0];

    const [dueR, subR] = await Promise.all([
      fetch(`${URL}/rest/v1/servicios_cobrados?renovacion_meses=not.is.null&renovacion_notificada=eq.false&proxima_renovacion=lte.${hoy}`, { headers: hdrs() }),
      fetch(`${URL}/rest/v1/push_subscriptions?activo=eq.true`, { headers: hdrs() }),
    ]);
    const due = (await dueR.json()) || [];
    const subs = (await subR.json()) || [];

    let enviados = 0;
    let expirados = 0;

    for (const servicio of due) {
      const payload = JSON.stringify({
        title: 'Renovación pendiente',
        body: `${servicio.cliente_nombre || 'Un cliente'} — enviar WhatsApp para renovar${servicio.descripcion ? ' (' + servicio.descripcion + ')' : ''}`,
        url: servicio.cliente_id ? `/clientes.html?id=${servicio.cliente_id}` : '/clientes.html',
      });

      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          );
          enviados++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            expirados++;
            await fetch(`${URL}/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
              method: 'PATCH', headers: hdrs(), body: JSON.stringify({ activo: false }),
            });
          }
        }
      }

      await fetch(`${URL}/rest/v1/servicios_cobrados?id=eq.${servicio.id}`, {
        method: 'PATCH', headers: hdrs(), body: JSON.stringify({ renovacion_notificada: true }),
      });
    }

    res.json({ ok: true, pendientes: due.length, enviados, expirados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
