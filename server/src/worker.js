// Times Dash friends' scores.
// Stores only: a nickname, an animal emoji, a public id (hash of a secret only the phone knows)
// and the best maths score per day. Anything older than 30 days is deleted every night.

export const EMOJIS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐨', '🐰', '🐶', '🐱', '🦄', '🐲', '🐙', '🐧', '🦉', '🐢'];
const MAX_BEST = 90;          // a 2-minute round: 90 right would already be superhuman
const MIN_GAP_MS = 20_000;    // one score per child per 20 s is plenty (a round takes 2 minutes)
const KEEP_DAYS = 30;
// Kept deliberately short: nicknames are for 6-10 year olds, so block the obvious ones.
const BLOCKED = ['fuck', 'shit', 'bitch', 'bastard', 'dick', 'cunt', 'piss', 'slut', 'whore', 'sex', 'porn', 'nigg', 'fag', 'rape', 'kill', 'stupid', 'idiot', 'dumb', 'loser', 'ugly', 'chutiya', 'madarchod', 'behenchod', 'bhenchod', 'gandu', 'randi', 'saala', 'kutta', 'kamina'];

const json = (body, status, cors) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...cors } });
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

export function cleanName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!/^[\p{L}][\p{L} ]{0,11}$/u.test(name)) return null;
  const flat = name.toLowerCase().replace(/[^\p{L}]/gu, '');
  if (BLOCKED.some((w) => flat.includes(w))) return null;
  return name;
}
export function validDay(day, now = Date.now()) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  // Players use their own calendar day; allow a day either side of UTC for time zones.
  return [now - 864e5, now, now + 864e5].map(isoDay).includes(day);
}
async function publicId(key) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').includes(origin);
    const cors = allowed ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', vary: 'origin' } : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });

    if (url.pathname === '/api/day' && req.method === 'GET') {
      const day = url.searchParams.get('d');
      if (!validDay(day)) return json({ error: 'bad day' }, 400, cors);
      const { results } = await env.DB.prepare('SELECT pid, name, emoji, best FROM scores WHERE day = ? ORDER BY updated DESC LIMIT 300').bind(day).all();
      return json({ day, players: results }, 200, { ...cors, 'cache-control': 'no-store' });
    }

    if (url.pathname === '/api/score' && req.method === 'POST') {
      if (!allowed) return json({ error: 'origin' }, 403, cors);
      let b;
      try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
      const name = cleanName(b && b.name);
      if (!b || typeof b.key !== 'string' || !/^[0-9a-f]{32,64}$/.test(b.key)) return json({ error: 'bad key' }, 400, cors);
      if (!name) return json({ error: 'name' }, 400, cors);
      if (!EMOJIS.includes(b.emoji)) return json({ error: 'emoji' }, 400, cors);
      if (!validDay(b.day)) return json({ error: 'bad day' }, 400, cors);
      if (!Number.isInteger(b.best) || b.best < 0 || b.best > MAX_BEST) return json({ error: 'score' }, 400, cors);
      const pid = await publicId(b.key), now = Date.now();
      const prev = await env.DB.prepare('SELECT best, updated FROM scores WHERE day = ? AND pid = ?').bind(b.day, pid).first();
      if (prev && now - prev.updated < MIN_GAP_MS && b.best > prev.best) return json({ error: 'slow down' }, 429, cors);
      await env.DB.prepare(
        `INSERT INTO scores (day, pid, name, emoji, best, updated) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(day, pid) DO UPDATE SET name = excluded.name, emoji = excluded.emoji,
           best = MAX(scores.best, excluded.best), updated = excluded.updated`,
      ).bind(b.day, pid, name, b.emoji, b.best, now).run();
      return json({ pid, best: Math.max(b.best, prev ? prev.best : 0) }, 200, cors);
    }

    // Leaving the friends' challenge removes every score that phone sent.
    if (url.pathname === '/api/leave' && req.method === 'POST') {
      if (!allowed) return json({ error: 'origin' }, 403, cors);
      let b;
      try { b = await req.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
      if (!b || typeof b.key !== 'string' || !/^[0-9a-f]{32,64}$/.test(b.key)) return json({ error: 'bad key' }, 400, cors);
      await env.DB.prepare('DELETE FROM scores WHERE pid = ?').bind(await publicId(b.key)).run();
      return json({ ok: true }, 200, cors);
    }

    return json({ error: 'not found' }, 404, cors);
  },

  async scheduled(_event, env) {
    await env.DB.prepare('DELETE FROM scores WHERE day < ?').bind(isoDay(Date.now() - KEEP_DAYS * 864e5)).run();
  },
};
