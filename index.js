import crypto from 'node:crypto';
const { SUPABASE_URL: U, SUPABASE_SERVICE_KEY: K, JWT_SECRET: S, ADMIN_PASSWORD: AP } = process.env;
const BUCKET = 'payments';
const H = { apikey: K, Authorization: 'Bearer ' + K };
const q = encodeURIComponent;

async function sb(path, { method = 'GET', body } = {}) {
  const r = await fetch(U + '/rest/v1/' + path, {
    method, headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text(); if (!r.ok) throw new Error(t);
  return t ? JSON.parse(t) : [];
}
const mac = d => crypto.createHmac('sha256', S).update(d).digest('base64url');
const sign = p => { const d = Buffer.from(JSON.stringify(p)).toString('base64url'); return d + '.' + mac(d); };
function verify(t) {
  if (!t || !t.includes('.')) return null;
  const [d, s] = t.split('.'); const e = mac(d);
  if (e.length !== s.length || !crypto.timingSafeEqual(Buffer.from(e), Buffer.from(s))) return null;
  try { const p = JSON.parse(Buffer.from(d, 'base64url')); return p.exp > Date.now() ? p : null; } catch { return null; }
}

export default async function handler(req, res) {
  const out = (c, o) => res.status(c).json(o);
  try {
    if (!U || !K || !S || !AP) return out(500, { error: 'Server env variables set nahi hain' });
    const a = req.query.a, b = req.body || {};

    // PUBLIC: customer registration
    if (a === 'register') {
      const name = String(b.name || '').trim(), phone = String(b.phone || '').trim();
      const team = parseInt(b.team, 10), age = parseInt(b.age, 10), budget = String(b.budget || '').slice(0, 60);
      if (name.length < 2 || name.length > 80) return out(400, { error: 'Naam sahi likho' });
      if (!/^[6-9]\d{9}$/.test(phone)) return out(400, { error: 'Sahi 10 digit number likho' });
      if (!(team >= 1 && team <= 100) || !(age >= 14 && age <= 90) || !budget) return out(400, { error: 'Details poori bharo' });
      const buf = Buffer.from(String(b.shot || ''), 'base64');
      if (buf.length < 1000 || buf.length > 3.5e6) return out(400, { error: 'Screenshot sahi nahi hai ya bahut badi hai' });
      const jpg = buf[0] === 0xff && buf[1] === 0xd8, png = buf[0] === 0x89 && buf[1] === 0x50;
      if (!jpg && !png) return out(400, { error: 'Sirf image screenshot upload karo' });
      const path = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${jpg ? 'jpg' : 'png'}`;
      const up = await fetch(`${U}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST', headers: { ...H, 'Content-Type': jpg ? 'image/jpeg' : 'image/png', 'x-upsert': 'false' }, body: buf
      });
      if (!up.ok) return out(500, { error: 'Screenshot save nahi hua' });
      await sb('registrations', { method: 'POST', body: { name, phone, team, age, budget, shot_path: path } });
      return out(200, { ok: true });
    }

    // ADMIN
    if (a === 'login') {
      const x = Buffer.from(String(b.password || '')), y = Buffer.from(AP);
      if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return out(401, { error: 'Galat password' });
      return out(200, { token: sign({ role: 'admin', exp: Date.now() + 7 * 864e5 }) });
    }
    const p = verify((req.headers.authorization || '').replace('Bearer ', ''));
    if (!p || p.role !== 'admin') return out(401, { error: 'Admin login karo' });

    if (a === 'list') return out(200, await sb('registrations?select=*&order=created_at.desc'));
    if (a === 'status') {
      if (!['pending', 'verified', 'rejected'].includes(b.status)) return out(400, { error: 'bad status' });
      await sb(`registrations?id=eq.${q(b.id)}`, { method: 'PATCH', body: { status: b.status } }); return out(200, { ok: true });
    }
    if (a === 'shot') {
      const r = (await sb(`registrations?id=eq.${q(req.query.id)}&select=shot_path`))[0]; if (!r) return out(404, { error: 'Nahi mila' });
      const s = await fetch(`${U}/storage/v1/object/sign/${BUCKET}/${r.shot_path}`, { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }) });
      const j = await s.json(); if (!s.ok) return out(500, { error: 'Sign fail' });
      return out(200, { url: U + '/storage/v1' + j.signedURL });
    }
    if (a === 'del') {
      const r = (await sb(`registrations?id=eq.${q(b.id)}&select=shot_path`))[0];
      if (r) await fetch(`${U}/storage/v1/object/${BUCKET}/${r.shot_path}`, { method: 'DELETE', headers: H });
      await sb(`registrations?id=eq.${q(b.id)}`, { method: 'DELETE' }); return out(200, { ok: true });
    }
    return out(404, { error: 'Unknown action' });
  } catch (e) { return out(500, { error: 'Server error' }); }
}
