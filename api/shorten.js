import { kv } from '@vercel/kv';

// Генерирует случайный код из 6 символов
function generateCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Поддержка и query-параметра и body (совместимость с текущим фронтендом fahrzeit)
  const url = req.query?.url || req.body?.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  // Базовая валидация URL
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    // Проверяем — вдруг такой длинный URL уже есть (дедупликация)
    const existingCode = await kv.get(`url:${url}`);
    if (existingCode) {
      return res.status(200).json({ short: `https://fhr.pp.ua/${existingCode}` });
    }

    // Генерируем уникальный код
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      attempts++;
      if (attempts > 10) throw new Error('Failed to generate unique code');
    } while (await kv.get(`code:${code}`));

    // Сохраняем: code → url и url → code (для дедупликации)
    // TTL 365 дней (в секундах)
    const TTL = 60 * 60 * 24 * 365;
    await kv.set(`code:${code}`, url, { ex: TTL });
    await kv.set(`url:${url}`, code, { ex: TTL });

    return res.status(200).json({ short: `https://fhr.pp.ua/${code}` });

  } catch (e) {
    console.error('Shorten error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
