// DOM HUD + comic pop-ups.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.pops = $('pops');
    this.scoreEl = $('score'); this.comboEl = $('combo');
    this.ammoEl = $('ammo'); this.weaponBox = $('weapon-box'); this.weaponName = $('weapon-name');
    this.focusBar = $('focus-bar'); this.focusFill = this.focusBar.firstElementChild;
    this.marksHint = $('marks-hint'); this.execBtn = $('btn-exec');
    this.armorEl = $('armor'); this.beatRing = $('beat-ring'); this.biomeEl = $('biome-name');
    this.crosshair = $('crosshair');
    this.armorEl.innerHTML = '<span></span>';
  }
  show(id, on) { $(id).classList.toggle('hidden', !on); }

  setScore(s, combo) {
    this.scoreEl.textContent = s.toLocaleString();
    this.comboEl.textContent = 'x' + combo;
    this.comboEl.style.transform = `scale(${1 + Math.min(combo, 12) * 0.04})`;
  }
  setWeapon(name, ammo, max) {
    this.weaponName.textContent = name;
    this.max = max; this.setAmmo(ammo);
  }
  setAmmo(n) {
    const max = this.max;
    if (!isFinite(max)) { this.ammoEl.innerHTML = '<b style="font-family:Bangers;font-size:22px;color:#00e5ff">∞ MELEE</b>'; this.weaponBox.classList.remove('empty'); return; }
    let h = ''; for (let i = 0; i < max; i++) h += `<i class="${i < n ? '' : 'spent'}"></i>`;
    this.ammoEl.innerHTML = h;
    this.weaponBox.classList.toggle('empty', n <= 0);
  }
  flashThrow() { this.weaponBox.classList.add('empty'); }
  setArmor(a) { this.armorEl.classList.toggle('broken', a <= 0); }
  setFocus(f, on) {
    this.focusBar.classList.toggle('on', on);
    this.focusFill.style.width = Math.max(0, f) * 100 + '%';
  }
  setMarking(on) { this.marksHint.classList.toggle('on', on); this.execBtn.classList.toggle('on', on); this.crosshair.classList.toggle('mark', on); }
  setRicochet(on) { this.crosshair.style.borderColor = on ? '#ff2e88' : ''; }
  beat() {
    const r = this.beatRing;
    r.animate([{ opacity: 0.85, transform: 'scale(.6)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 300, easing: 'ease-out' });
  }
  // ---------- tutorial ----------
  tutorial(on) { $('tut').classList.toggle('hidden', !on); if (!on) $('ready').classList.add('hidden'); }
  setStep(n, total, title, html) {
    $('tut-step').textContent = `STEP ${n}/${total} · ${title}`;
    $('tut-text').innerHTML = html;
    const c = $('tut-card'); c.classList.remove('in'); void c.offsetWidth; c.classList.add('in');
  }
  setCharge(pct) {
    $('charge-fill').style.height = pct + '%';
    const el = $('charge-pct'); el.textContent = pct + '%';
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    if (pct > 0) { const r = $('charge-bar').getBoundingClientRect(); this.pop('+10%', r.left - 30, r.top + r.height * (1 - pct / 100), '#ffe600', 34); }
  }
  pulseHint(on) { this.beatRing.classList.toggle('hint', on); }
  readySplash() {
    const r = $('ready'); r.classList.remove('hidden');
    r.querySelectorAll('div').forEach((d) => { d.style.animation = 'none'; void d.offsetWidth; d.style.animation = ''; });
    $('tut-card').style.visibility = 'hidden';
    setTimeout(() => { r.classList.add('hidden'); $('tut-card').style.visibility = ''; }, 2800);
  }

  biome(name) { const b = this.biomeEl; b.textContent = name; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); }
  moveCrosshair(x, y) { this.crosshair.style.left = x + 'px'; this.crosshair.style.top = y + 'px'; }

  pop(text, x, y, color = '#ffe600', size = 40, big = false) {
    if (this.pops.childElementCount > 24) this.pops.firstElementChild.remove();
    const d = document.createElement('div');
    d.className = 'pop' + (big ? ' big' : '');
    d.textContent = text;
    d.style.left = Math.max(60, Math.min(innerWidth - 60, x)) + 'px';
    d.style.top = Math.max(50, Math.min(innerHeight - 50, y)) + 'px';
    d.style.color = color; d.style.fontSize = size * Math.min(1, innerWidth / 700 + 0.35) + 'px';
    d.style.textShadow = `${size / 12}px ${size / 12}px 0 #0b0410`;
    this.pops.appendChild(d);
    setTimeout(() => d.remove(), big ? 1150 : 850);
  }
  // comic starburst behind hits
  burst(x, y, color) {
    const n = 12, r1 = 46, r2 = 22;
    let pts = '';
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r2 : r1 * (0.8 + Math.random() * 0.4); pts += `${60 + Math.cos(a) * r},${60 + Math.sin(a) * r} `; }
    const d = document.createElement('div'); d.className = 'burst';
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.innerHTML = `<svg width="120" height="120"><polygon points="${pts}" fill="${color}" stroke="#0b0410" stroke-width="4"/></svg>`;
    this.pops.prepend(d);
    d.animate([{ transform: 'translate(-50%,-50%) scale(.3) rotate(0deg)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1.1) rotate(20deg)', opacity: 0 }], { duration: 260, easing: 'ease-out' });
    setTimeout(() => d.remove(), 260);
  }
}
