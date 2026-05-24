import { Redis } from '@upstash/redis';

const kv = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function checkAuth(req) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  const expected = Buffer.from(`${process.env.ADMIN_PASSWORD}:fhr-admin-2026`).toString('base64');
  return token === expected;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const codes = await kv.lrange('links', 0, -1);
    if (!codes || codes.length === 0) return res.status(200).json({ links: [] });

    const links = await Promise.all(codes.map(async (code) => {
      const [metaRaw, hits] = await Promise.all([
        kv.get(`meta:${code}`),
        kv.lrange(`hits:${code}`, 0, -1)
      ]);

      if (!metaRaw) return null;
      const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;

      return {
        code,
        url: meta.url,
        created: meta.created,
        clicks: meta.clicks || 0,
        lastClick: meta.lastClick || null,
        hits: (hits || []).map(Number).sort((a, b) => b - a)
      };
    }));

    return res.status(200).json({
      links: links.filter(Boolean).sort((a, b) => b.created - a.created)
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
