// Step-by-step tutorial. Each step fills the HEADBANG CHARGE meter by 10%.
import { LANES } from './world.js';

const touch = matchMedia('(pointer:coarse)').matches;
const T = (pc, phone) => (touch ? phone : pc);

export function makeSteps() {
  return [
    {
      title: 'MOVE', text: T('Press <b>A</b> and <b>D</b> to switch lanes', '<b>Swipe left & right</b> to switch lanes'),
      init(s) { s.l = false; s.r = false; },
      on(s, ev, d) { if (ev === 'lane') { if (d.dir < 0) s.l = true; else s.r = true; } return s.l && s.r; },
    },
    {
      title: 'JUMP', text: T('<b>W / Space</b> to jump the barrier', '<b>Swipe up</b> to jump the barrier'),
      ensure(g, s) { if (!s.h || !g.hazards.includes(s.h)) s.h = g.spawnHazard(26, 'low'); },
      on(s, ev, d) { return ev === 'hazard' && d.kind === 'low' && d.ok; },
    },
    {
      title: 'SLIDE', text: T('<b>S</b> to slide under the bar', '<b>Swipe down</b> to slide under the bar'),
      ensure(g, s) { if (!s.h || !g.hazards.includes(s.h)) s.h = g.spawnHazard(26, 'high'); },
      on(s, ev, d) { return ev === 'hazard' && d.kind === 'high' && d.ok; },
    },
    {
      title: 'SHOOT', text: T('<b>Click</b> the goons — take down 2', '<b>Tap</b> the goons — take down 2'),
      init(s) { s.n = 0; },
      ensure(g, s) { ensureTargets(g, s, 2, 'pistol'); },
      on(s, ev) { if (ev === 'kill') s.n++; return s.n >= 2; },
    },
    {
      title: 'HEADSHOT', text: 'Aim for the <b>head</b>. One clean headshot.',
      ensure(g, s) { ensureTargets(g, s, 1, 'smg'); },
      on(s, ev, d) { return ev === 'kill' && d.head; },
    },
    {
      title: 'ON THE BEAT', text: 'Shoot when the <b>ring pulses</b> — hit the kick drum',
      ensure(g, s) { ensureTargets(g, s, 2, 'pistol'); g.ui.pulseHint(true); },
      on(s, ev, d) { return ev === 'kill' && !!d.beat; },
      done(g) { g.ui.pulseHint(false); },
    },
    {
      title: 'DODGE', text: T('They shoot on the beat — <b>switch lanes</b> to dodge 3 bullets', 'They shoot on the beat — <b>swipe</b> to dodge 3 bullets'),
      init(s) { s.n = 0; },
      ensure(g, s) {
        const live = g.enemies.filter((e) => e.alive && e.tut && g.p.z - e.obj.position.z > 9);
        if (!live.length) { const e = g.spawnEnemy('smg', 2.2, 30, g.audio.beat + 0.5, 0); e.tut = true; e.fireOffset = 0; }
      },
      on(s, ev, d) { if (ev === 'bullet' && !d.hit && d.dx < 3.5) s.n++; return s.n >= 3; },
      done(g) { for (const e of g.enemies) if (e.tut && e.alive) g.killEnemy(e, 'body'); },
    },
    {
      title: 'THROW & STEAL', text: T('Out of ammo! Press <b>F</b> or <b>right-click</b> to throw your gun and steal theirs', 'Out of ammo! Hit <b>THROW</b> to chuck your gun and steal theirs'),
      init(s, g) { g.setWeapon('pistol', 0); },
      ensure(g, s) {
        if (g.p.weapon === 'fists' && !g.thrown.length) g.setWeapon('pistol', 0);
        ensureTargets(g, s, 1, 'shotgun');
      },
      on(s, ev, d) { return ev === 'kill' && d.thrown; },
    },
    {
      title: 'WALL RUN', text: T('Get on an <b>outer lane</b>, then <b>jump</b> into the wall', 'Get on an <b>outer lane</b>, then <b>swipe up</b> into the wall'),
      on(s, ev) { return ev === 'wallrun'; },
    },
    {
      title: 'FOCUS', text: T('Land <b>3 headshots in a row</b> to charge FOCUS, press <b>Q</b>, then click 2 goons', 'Land <b>3 headshots in a row</b> to charge FOCUS, hit <b>FOCUS</b>, then tap 2 goons'),
      ensure(g, s) {
        if (g.bulletTime) return;
        ensureTargets(g, s, 3, 'pistol', 30);
      },
      on(s, ev, d) { return ev === 'bulletTimeEnd' && d.kills >= 2; },
    },
  ];
}

// keep N passive targets standing ahead of the player
function ensureTargets(g, s, n, type, dist = 26) {
  const live = g.enemies.filter((e) => e.alive && e.tut && g.p.z - e.obj.position.z > 6);
  if (live.length) return;
  if (s.cool && performance.now() < s.cool) return;
  s.cool = performance.now() + 400;
  // always inside the corridor (walls sit at ±3.7)
  const xs = n === 1 ? [LANES[1]] : n === 2 ? [LANES[0], LANES[2]] : [LANES[0], LANES[1], LANES[2]];
  xs.forEach((x, i) => { const e = g.spawnEnemy(type, x, dist + i * 3, g.audio.beat + 1 + i * 0.5, 0, true); e.tut = true; });
}

export class Tutorial {
  constructor(game, ui, onComplete) {
    this.game = game; this.ui = ui; this.onComplete = onComplete;
    this.steps = makeSteps(); this.i = -1; this.state = {}; this.active = false;
  }
  start() {
    this.active = true; this.i = -1;
    this.game.world.forceWalls = true;
    this.ui.tutorial(true); this.ui.setCharge(0);
    this.game.onEvent = (ev, d) => this.handle(ev, d);
    setTimeout(() => this.next(), 900);
  }
  stop() {
    this.ack();
    this.active = false; this.game.world.forceWalls = false;
    this.game.onEvent = null; this.ui.tutorial(false); this.ui.pulseHint(false);
  }
  next() {
    if (!this.active) return;
    const prev = this.steps[this.i];
    if (prev && prev.done) prev.done(this.game);
    this.i++;
    if (this.i >= this.steps.length) return this.finish();
    const st = this.steps[this.i];
    this.state = {}; this.wait = false;
    if (st.init) st.init(this.state, this.game);
    this.ui.setStep(this.i + 1, this.steps.length, st.title, st.text);
    this.brief();
  }
  brief() {
    this.briefing = true; this.game.briefing = true; this.briefAt = performance.now();
    this.ui.setBrief(true); this.game.audio.sfx('tapeStop');
  }
  ack() {
    if (!this.briefing) return;
    this.briefing = false; this.game.briefing = false;
    this.ui.setBrief(false); this.game.audio.sfx('tapeStart');
  }
  handle(ev, d) {
    if (!this.active || this.wait || this.i < 0 || this.briefing) return;
    const st = this.steps[this.i];
    if (st.on(this.state, ev, d)) {
      this.wait = true;
      const pct = Math.round(((this.i + 1) / this.steps.length) * 100);
      this.ui.setCharge(pct);
      this.game.audio.sfx('pickup');
      this.ui.pop('NAILED IT!', innerWidth / 2, innerHeight * 0.38, '#9dff3c', 46, true);
      setTimeout(() => this.next(), 1300);
    }
  }
  update() {
    if (this.briefing && performance.now() - this.briefAt > 6000) this.ack(); // auto-continue
    if (!this.active || this.wait || this.i < 0) return;
    const st = this.steps[this.i];
    if (st.ensure) st.ensure(this.game, this.state);
    // keep the player safe & stocked during the lesson
    if (this.game.p.armor < 2) { this.game.p.armor = 2; this.ui.setArmor(2); }
  }
  finish() {
    this.active = false; this.game.onEvent = null;
    try { localStorage.setItem('headbanger.tutorial', '1'); } catch (e) {}
    this.ui.readySplash();
    this.game.audio.sfx('slowIn');
    setTimeout(() => { this.stop(); this.onComplete && this.onComplete(); }, 2800);
  }
}
