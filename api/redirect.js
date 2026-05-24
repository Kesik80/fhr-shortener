import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const url = await kv.get(`code:${code}`);

    if (!url) {
      return res.status(404).send(`<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><title>404</title>
<style>body{font-family:sans-serif;text-align:center;padding:60px 20px;background:#111;color:#ccc}h1{color:#ff4444}a{color:#4af}</style>
</head><body><h1>404</h1><p>Link <code>${code}</code> nicht gefunden.</p><a href="https://fhr.pp.ua">← fhr.pp.ua</a></body></html>`);
    }

    // Обновляем статистику асинхронно (не блокируем редирект)
    const now = Date.now();
    const metaRaw = await kv.get(`meta:${code}`);
    if (metaRaw) {
      const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;
      meta.clicks = (meta.clicks || 0) + 1;
      meta.lastClick = now;
      const TTL = 60 * 60 * 24 * 365;
      await kv.set(`meta:${code}`, JSON.stringify(meta), { ex: TTL });
    }
    // История переходов (храним последние 100)
    await kv.lpush(`hits:${code}`, now);
    await kv.ltrim(`hits:${code}`, 0, 99);

    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(301, url);
  } catch (e) {
    console.error('Redirect error:', e.message);
    return res.status(500).send('Internal server error');
  }
}
