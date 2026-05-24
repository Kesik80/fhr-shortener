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
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    const metaRaw = await kv.get(`meta:${code}`);
    if (!metaRaw) return res.status(404).json({ error: 'Link not found' });

    const meta = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : metaRaw;

    await Promise.all([
      kv.del(`code:${code}`),
      kv.del(`url:${meta.url}`),
      kv.del(`meta:${code}`),
      kv.del(`hits:${code}`),
      kv.lrem('links', 0, code),
    ]);

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
