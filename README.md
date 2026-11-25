# HEADBANGER

**▶ Play: https://prantoverse.github.io/headbanger/**

**Gun-fu × heavy metal × bullet time.** An endless rhythm-shooter runner in a Spider-Verse comic style, built with three.js. Plays in the browser on phone and PC.

- Shoot on the beat, go for headshots. Enemies die in one hit, and so do you (after your armor breaks).
- Dodge lanes, jump, slide, and **wall run**. Bullets, barriers and rockets are all telegraphed to the music.
- **No reloading.** When your gun runs dry, **throw it** at an enemy and steal their weapon.
- Goons are Superhot-red and **shatter into shards** from wherever your bullet lands.
- **3 headshots in a row** charges FOCUS. Press **Q**: time slows, the music drops to half-time with a heartbeat, and every click is a free kill.
- **6 in a row** also loads a ricochet round that chains through the crowd.
- Four looping worlds: Neon Rooftops → Inside the Machine → Alien World → Orbital Station, each faster than the last.

## Controls
| | PC | Phone |
|---|---|---|
| Shoot / mark | Click | Tap |
| Lane | A / D | Swipe ← → |
| Jump / wall run | W / Space | Swipe ↑ |
| Slide | S / Ctrl / C | Swipe ↓ |
| Throw weapon | F / right-click | THROW button / two-finger tap |
| FOCUS (when charged) | Q | FOCUS button |

Gamepad works too (stick, A jump, B slide, X throw, Y focus, RT shoot). Haptics work on Android and gamepads (iOS Safari has no Vibration API).

## Dev
```bash
npm i
npm run dev     # local
npm run build   # static build in dist/
```

## Tech
- **Render:** three.js toon materials → a custom comic post shader (depth + colour Sobel ink lines, halftone shadows, CMY misregistration, speed lines, slow-mo duotone, impact frames). Enemies animate "on twos" (12 fps).
- **Audio:** heavy-metal loops synthesized in Web Audio and pre-rendered with `OfflineAudioContext`. Slow-mo drops `playbackRate`, so tempo and pitch bend together and the beat clock stays in sync.
- To swap in your own track, replace `AudioEngine.buffers[i]` with a decoded file at **150 BPM**, or change `BPM` in `src/audio.js`.
