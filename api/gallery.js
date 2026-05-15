const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (_req, res) => {
  try {
    const { data, error } = await supabase.storage
      .from('galeria')
      .list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

    if (error) throw error;

    const images = (data || [])
      .filter(f => f.name !== '.emptyFolderPlaceholder')
      .map(f => ({
        url: `${process.env.SUPABASE_URL}/storage/v1/object/public/galeria/${f.name}`,
      }));

    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
