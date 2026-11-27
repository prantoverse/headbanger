# HEADBANGER

**▶ Play: https://prantoverse.github.io/headbanger/**

**Gun-fu × darksynth × bullet time.** An endless rhythm-shooter runner in a Spider-Verse comic style, built with three.js. Plays in the browser on phone and PC.

- Shoot on the beat, go for headshots. Enemies die in one hit. You have up to 3 armor pips (start with 2); **every 2 headshots restores one**.
- Dodge lanes, jump, slide, and **wall run**. Bullets, barriers and rockets are all telegraphed to the music.
- **No reloading.** When your gun runs dry, **throw it** at an enemy and steal their weapon. Out of guns? **Punch** a goon to disarm them and take theirs; dropped guns fly to your empty hands.
- Goons: pistol, machine pistol, shotgun, katana, **baseball bat** (steal it for HOME RUNs) and **ninjas** that rappel in upside down throwing shurikens (steal their stars).
- Goons are Superhot-red and **shatter into shards** from wherever your bullet lands.
- **3 headshots in a row** charges FOCUS. Press **Q**: time slows, the music drops to half-time with a heartbeat, and every click is a free kill.
- **6 in a row** also loads a ricochet round that chains through the crowd.
- **HEAT** rises every 25 seconds: faster running, more goons per group, new goon types, more obstacles.
- Fever-dream backdrop: Starry-Night swirl skies and painterly brushwork under the comic ink, giant mechs blasting off from the roadside, huge eyes in the sky that follow you and wink, sky traffic, a colossal flying submarine, satellites.
- Goofy chaos: bobblehead goons, disco-ball goons (4 beats of rainbow), pigeon swarms (COO!), giant rubber ducks blocking lanes, banana peels, Team-Rocket shotgun yeets, confetti every 10th headshot, Bangla comic SFX (ঢিশুম!).
- GROOVE ZONE about once a minute: rainbow hue roll, wavy screen, kaleidoscope sky and an auto-wah on the music.
- Sky oddities: a giant cat paw, floating moai heads, a jetpack whale spouting confetti, a sky DJ, and a pizza moon with an orbiting slice.
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
