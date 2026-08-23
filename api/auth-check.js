const { verify, cookieFrom, configured } = require('./_auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!configured()) return res.json({ configured: false, authenticated: false });

  const session = verify(cookieFrom(req));
  if (!session) return res.status(401).json({ configured: true, authenticated: false });
  res.json({ configured: true, authenticated: true, email: session.email });
};
