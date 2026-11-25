import * as THREE from 'three';
import { AudioEngine } from './audio.js';
import { World } from './world.js';
import { Game, WEAPONS } from './game.js';
import { ComicPost } from './post.js';
import { UI } from './ui.js';
import { Tutorial } from './tutorial.js';
import { SetPieces } from './setpieces.js';

const canvas = document.getElementById('c');
const coarse = matchMedia('(pointer:coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio, coarse ? 1.25 : 1.5);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 460);
scene.add(camera);

const audio = new AudioEngine();
const world = new World(scene);
const ui = new UI();
const setpieces = new SetPieces(scene, world);
const post = new ComicPost(renderer, camera);
const haptics = (pattern) => {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  // gamepad rumble (Chrome)
  try {
    for (const gp of navigator.getGamepads ? navigator.getGamepads() : []) {
      const a = gp && gp.vibrationActuator;
      if (a) a.playEffect('dual-rumble', { duration: Array.isArray(pattern) ? 120 : pattern * 2, strongMagnitude: 0.6, weakMagnitude: 0.8 });
    }
  } catch (e) {}
};
const game = new Game({ scene, camera, audio, world, ui, post, haptics });

// attract-mode camera before play
camera.position.set(0, 1.6, 0);

let best = 0;
try { best = +localStorage.getItem('headbanger.best') || 0; } catch (e) {}
const bestEl = document.getElementById('best');
const showBest = () => (bestEl.textContent = best ? `BEST: ${best.toLocaleString()}` : '');
showBest();

game.onGameOver = () => {
  game.running = false; audio.stop();
  const s = game.score, st = game.stats;
  const newBest = s > best;
  if (newBest) { best = s; try { localStorage.setItem('headbanger.best', String(best)); } catch (e) {} }
  document.getElementById('final').innerHTML =
    `<b>${s.toLocaleString()}</b>${newBest ? 'NEW BEST!<br>' : ''}${st.kills} KILLS · ${st.heads} HEADSHOTS<br>${st.beats} ON THE BEAT · ${Math.round(st.dist)}m`;
  ui.show('hud', false); ui.show('over', true); showBest();
};

// ---------------------------------------------------------------- menu + tutorial flags
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
};
const notepad = document.getElementById('btn-tutorial');
function refreshMenu() {
  const done = store.get('headbanger.tutorial') === '1';
  notepad.classList.remove('done'); void notepad.offsetWidth;
  notepad.classList.toggle('done', done);
  document.getElementById('menu-hint').textContent = store.get('headbanger.tutSeen') ? 'Space / Enter to play' : 'First time? PLAY starts with a quick tutorial.';
}
refreshMenu();

const tutorial = new Tutorial(game, ui, () => startGame('run'));

let audioReady = null;
async function startGame(mode) {
  if (typeof mode !== 'string') mode = store.get('headbanger.tutSeen') ? 'run' : 'tutorial';
  if (tutorial.active || mode === 'run') tutorial.stop();
  if (!audioReady) audioReady = audio.init();
  audio.resume && audio.ctx && audio.resume();
  const playBtn = document.getElementById('btn-play'), label = playBtn.textContent;
  playBtn.textContent = 'TUNING GUITARS…';
  await audioReady; audio.resume(); playBtn.textContent = label;
  ui.show('menu', false); ui.show('over', false); ui.show('hud', true);
  world.reset(); setpieces.reset();
  game.start(mode);
  audio.play(0);
  if (mode === 'tutorial') {
    store.set('headbanger.tutSeen', '1');
    ui.biome('TRAINING DAY');
    tutorial.start();
  } else ui.biome('NEON ROOFTOPS');
}
function toMenu() {
  tutorial.stop(); game.running = false; audio.stop();
  ui.show('hud', false); ui.show('over', false); ui.show('menu', true);
  refreshMenu(); showBest();
}
document.getElementById('btn-play').addEventListener('click', () => startGame());
document.getElementById('btn-again').addEventListener('click', () => startGame('run'));
document.getElementById('btn-menu').addEventListener('click', toMenu);
notepad.addEventListener('click', () => startGame('tutorial'));
document.getElementById('btn-skip').addEventListener('pointerdown', (e) => { e.stopPropagation(); startGame('run'); });

// ---------------------------------------------------------------- input
let pointer = { x: innerWidth / 2, y: innerHeight / 2, down: false, auto: 0 };
const touches = new Map();

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (!game.running) return;
  pointer.x = e.clientX; pointer.y = e.clientY; ui.moveCrosshair(e.clientX, e.clientY);
  game.setAim(e.clientX, e.clientY);
  if (e.pointerType === 'mouse') {
    if (e.button === 2) game.throwWeapon(e.clientX, e.clientY);
    else { pointer.down = true; game.fire(e.clientX, e.clientY); }
    return;
  }
  // touch / pen: decide tap vs swipe
  touches.set(e.pointerId, { x0: e.clientX, y0: e.clientY, t0: performance.now(), swiped: false, x: e.clientX, y: e.clientY });
  if (touches.size === 2) { game.throwWeapon(); for (const t of touches.values()) t.swiped = true; }
});
canvas.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX; pointer.y = e.clientY;
  if (e.pointerType === 'mouse') { ui.moveCrosshair(e.clientX, e.clientY); game.setAim && game.aim && game.setAim(e.clientX, e.clientY); return; }
  const t = touches.get(e.pointerId); if (!t || t.swiped) return;
  t.x = e.clientX; t.y = e.clientY;
  const dx = e.clientX - t.x0, dy = e.clientY - t.y0;
  const th = Math.max(36, innerWidth * 0.06);
  if (Math.hypot(dx, dy) > th) {
    t.swiped = true;
    if (Math.abs(dx) > Math.abs(dy)) game.lane(dx > 0 ? 1 : -1);
    else if (dy < 0) game.jump(); else game.slide();
  }
});
const endTouch = (e) => {
  if (e.pointerType === 'mouse') { pointer.down = false; return; }
  const t = touches.get(e.pointerId); touches.delete(e.pointerId);
  if (!t || t.swiped || !game.running) return;
  game.fire(t.x0, t.y0); // a tap = shoot where you tapped
};
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

addEventListener('keydown', (e) => {
  if (!game.running) { if (e.code === 'Enter' || e.code === 'Space') { const vis = !document.getElementById('menu').classList.contains('hidden') || !document.getElementById('over').classList.contains('hidden'); if (vis) startGame(); } return; }
  if (e.ctrlKey || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault(); // Ctrl = slide; stop Ctrl+D/S/A browser shortcuts
  if (e.repeat) return;
  switch (e.code) {
    case 'KeyA': case 'ArrowLeft': game.lane(-1); break;
    case 'KeyD': case 'ArrowRight': game.lane(1); break;
    case 'KeyW': case 'ArrowUp': case 'Space': game.jump(); e.preventDefault(); break;
    case 'KeyS': case 'ArrowDown': case 'ControlLeft': case 'ControlRight': case 'KeyC': game.slide(); break;
    case 'KeyF': game.throwWeapon(pointer.x, pointer.y); break;
    case 'KeyQ': game.activateFocus(); break;
    case 'Escape': toMenu(); break;
  }
});
document.getElementById('btn-throw').addEventListener('pointerdown', (e) => { e.stopPropagation(); game.throwWeapon(); });
document.getElementById('btn-focus').addEventListener('pointerdown', (e) => { e.stopPropagation(); game.activateFocus(); });

// gamepad: left stick lanes, A jump, B slide, X throw, RT fire at screen center
let gpPrev = {};
function pollGamepad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp || !game.running) return;
  const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
  const edge = (k, v) => { const r = v && !gpPrev[k]; gpPrev[k] = v; return r; };
  const ax = gp.axes[0] || 0;
  if (edge('l', ax < -0.6)) game.lane(-1);
  if (edge('r', ax > 0.6)) game.lane(1);
  if (edge('a', b(0))) game.jump();
  if (edge('b', b(1))) game.slide();
  if (edge('x', b(2))) game.throwWeapon();
  if (edge('y', b(3))) game.activateFocus();
  if (edge('rt', b(7))) game.fire(innerWidth / 2, innerHeight / 2);
}

// ---------------------------------------------------------------- loop
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); post.setSize();
});

const timer = new THREE.Timer(); timer.connect(document);
let attractZ = 0;
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(Math.max(timer.getDelta(), 0), 0.05);
  pollGamepad();
  if (game.running) {
    // machine-pistol: hold to spray
    if (pointer.down && WEAPONS[game.p.weapon].auto && !game.bulletTime) game.fire(pointer.x, pointer.y);
    for (const t of touches.values()) if (!t.swiped && WEAPONS[game.p.weapon].auto && performance.now() - t.t0 > 180) game.fire(t.x, t.y);
    if (coarse && game.aim) { game.aim.x *= Math.exp(-dt * 2.5); game.aim.y *= Math.exp(-dt * 2.5); }
    game.update(dt);
    setpieces.update(game.p.z, dt * game.timeScale, audio.songPos, world.beatPulse);
    tutorial.update();
  } else if (!game.p || !game.p.dead) {
    // menu attract: glide through the world
    attractZ -= dt * 8;
    camera.position.set(Math.sin(attractZ * 0.05) * 1.5, 2.2, attractZ);
    camera.rotation.set(-0.05, Math.sin(attractZ * 0.03) * 0.2, Math.sin(attractZ * 0.04) * 0.05);
    world.update(attractZ, dt, (performance.now() / 400) % 1, performance.now() / 1000);
    setpieces.update(attractZ, dt, performance.now() / 1000, world.beatPulse);
    post.u.time.value += dt; post.u.speed.value = 0.2;
  } else {
    game.update(dt * 0.3);
  }
  post.render(scene);
});

// show title pop-in
document.getElementById('title').animate([{ transform: 'rotate(-3deg) scale(2)', opacity: 0 }, { transform: 'rotate(-3deg) scale(1)', opacity: 1 }], { duration: 500, easing: 'cubic-bezier(.2,1.6,.4,1)' });
window.__game = game;
window.__tut = tutorial;
window.__sp = setpieces;
