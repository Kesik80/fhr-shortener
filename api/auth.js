export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const correct = process.env.ADMIN_PASSWORD;

  if (!correct) return res.status(500).json({ error: 'ADMIN_PASSWORD not set' });
  if (password !== correct) return res.status(401).json({ error: 'Wrong password' });

  // Простой токен = хэш пароля + соль (достаточно для личного использования)
  const token = Buffer.from(`${correct}:fhr-admin-2026`).toString('base64');
  return res.status(200).json({ token });
}
