// Poki SDK wrapper. Only active in the Poki build (vite --mode poki); everywhere else it's a no-op.
export const POKI = import.meta.env.MODE === 'poki';
const sdk = () => (POKI ? window.PokiSDK : null);
let playing = false, ready = Promise.resolve();

export const Poki = {
  init() { if (sdk()) ready = sdk().init().catch(() => {}); return ready; }, // game loads even if init fails
  loaded() { ready.then(() => sdk() && sdk().gameLoadingFinished()); },
  start() { if (playing) return; playing = true; sdk() && sdk().gameplayStart(); },  // never fires twice in a row
  stop() { if (!playing) return; playing = false; sdk() && sdk().gameplayStop(); },
  // ad opportunity before heading back into gameplay; mute() runs only if an ad actually plays
  break(mute) {
    this.stop();
    if (!sdk()) return Promise.resolve();
    return ready.then(() => sdk().commercialBreak(() => mute && mute())).catch(() => {});
  },
};
