import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing code');
  }

  try {
    const url = await kv.get(`code:${code}`);

    if (!url) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="de">
        <head>
          <meta charset="UTF-8">
          <title>Link nicht gefunden</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 60px 20px; background: #111; color: #ccc; }
            h1 { color: #ff4444; }
            a { color: #4af; }
          </style>
        </head>
        <body>
          <h1>404</h1>
          <p>Link <code>${code}</code> nicht gefunden oder abgelaufen.</p>
          <a href="https://fahrzeit.vercel.app">← Fahrzeit Rechner</a>
        </body>
        </html>
      `);
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.redirect(301, url);

  } catch (e) {
    console.error('Redirect error:', e.message);
    return res.status(500).send('Internal server error');
  }
}
