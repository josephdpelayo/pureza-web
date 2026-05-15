const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = async (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const result = await cloudinary.search
      .expression('folder:galeria')
      .sort_by('created_at', 'desc')
      .max_results(30)
      .execute();

    const images = result.resources.map(r => ({
      url: r.secure_url,
      public_id: r.public_id,
    }));

    res.setHeader('Cache-Control', 's-maxage=60');
    res.json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
