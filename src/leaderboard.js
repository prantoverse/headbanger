// Global leaderboard (Supabase RPCs, no SDK). Anonymous: a random device id + a display name.
// Weekly + all-time boards per style. Everything fails soft: offline / blocked → the game carries on.
const URL = 'https://thtylhovgfknkxbxyfso.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable_WyuRBAjJL9E4UU2Au6hvlA_4TjU9Lj2'; // publishable (client-safe) key

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

const ADJ = ['NEON', 'RAD', 'ZEN', 'WILD', 'SLICK', 'TURBO', 'MEGA', 'LUCKY', 'SHADY', 'HYPER', 'COSMIC', 'SALTY'];
const NOUN = ['WOLF', 'CROC', 'DUCK', 'NINJA', 'VIPER', 'GHOST', 'TIGER', 'MOAI', 'COBRA', 'PANDA', 'HAWK', 'BEAR'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export const LB = {
  device: store.get('headbanger.device') || (() => { const d = uuid(); store.set('headbanger.device', d); return d; })(),
  name: store.get('headbanger.name') || (() => { const n = `${pick(ADJ)}-${pick(NOUN)}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 14); store.set('headbanger.name', n); return n; })(),
  online: true,

  async call(fn, body) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 7000);
    try {
      const r = await fetch(URL + fn, { method: 'POST', signal: ctl.signal, headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return { error: (await r.json().catch(() => ({}))).message || r.status };
      this.online = true; return await r.json();
    } catch (e) { this.online = false; return null; } finally { clearTimeout(t); }
  },
  submit(score, style, seconds, heat) {
    return this.call('submit_score', { p_device: this.device, p_name: this.name, p_style: style, p_score: Math.floor(score), p_seconds: Math.max(5, Math.round(seconds)), p_heat: heat });
  },
  board(style, period) { return this.call('get_leaderboard', { p_style: style, p_period: period, p_device: this.device }); },
  async rename(n) {
    const r = await this.call('rename_player', { p_device: this.device, p_name: n });
    this.name = typeof r === 'string' ? r : n.toUpperCase().slice(0, 14);
    store.set('headbanger.name', this.name);
    return this.name;
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// rows → html table; `me` row appended under the top list if you're outside it
export function boardHTML(data, limit = 20) {
  if (!data || data.error) return `<div class="lb-empty">${LB.online ? 'Leaderboard unavailable right now.' : 'You’re offline — the board will be back.'}</div>`;
  if (!data.top.length) return '<div class="lb-empty">No scores yet. Be the first legend.</div>';
  const row = (r) => `<tr class="${r.me ? 'me' : ''}"><td>#${r.rank}</td><td>${esc(r.name)}</td><td>${r.score.toLocaleString()}</td><td>H${r.heat}</td></tr>`;
  const top = data.top.slice(0, limit);
  let html = '<table class="lb-table">' + top.map(row).join('');
  if (data.me && !top.some((r) => r.me)) html += '<tr class="gap"><td colspan="4">⋯</td></tr>' + row(data.me);
  return html + '</table>' + `<div class="lb-count">${data.players.toLocaleString()} player${data.players === 1 ? '' : 's'}</div>`;
}

// editable "playing as" name chip
export function nameChip(el, onChange) {
  const draw = () => {
    el.innerHTML = `PLAYING AS <b>${esc(LB.name)}</b> <button class="lb-edit" aria-label="Change name">✎</button>`;
    el.querySelector('.lb-edit').onclick = (e) => {
      e.stopPropagation();
      el.innerHTML = `<input class="lb-input" maxlength="14" value="${esc(LB.name)}" aria-label="Your name"><button class="lb-save">SAVE</button>`;
      const inp = el.querySelector('input'); inp.focus(); inp.select();
      const save = async () => { const v = inp.value.trim(); if (v.length >= 2) await LB.rename(v); draw(); onChange && onChange(); };
      el.querySelector('.lb-save').onclick = (ev) => { ev.stopPropagation(); save(); };
      inp.onkeydown = (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') save(); if (ev.key === 'Escape') draw(); };
    };
  };
  draw();
}
