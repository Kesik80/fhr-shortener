import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function generateCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = req.query?.url || req.body?.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  try {
    const existingCode = await kv.get(`url:${url}`);
    if (existingCode) {
      return res.status(200).json({ short: `https://fhr.pp.ua/${existingCode}`, code: existingCode });
    }

    let code, attempts = 0;
    do {
      code = generateCode();
      if (++attempts > 10) throw new Error('Failed to generate unique code');
    } while (await kv.get(`code:${code}`));

    const TTL = 60 * 60 * 24 * 365;
    await kv.set(`code:${code}`, url, { ex: TTL });
    await kv.set(`url:${url}`, code, { ex: TTL });
    await kv.set(`meta:${code}`, JSON.stringify({ url, created: Date.now(), clicks: 0, lastClick: null }), { ex: TTL });
    await kv.lpush('links', code);

    return res.status(200).json({ short: `https://fhr.pp.ua/${code}`, code });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
