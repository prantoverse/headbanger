import { defineConfig } from 'vite';
// relative base so the same build works on GitHub Pages (/headbanger/) and Poki.
// `vite build --mode poki` → dist-poki/ with the Poki SDK, no leaderboard, no debug handles.
export default defineConfig(({ mode }) => ({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200, outDir: mode === 'poki' ? 'dist-poki' : 'dist' },
  plugins: [{
    name: 'poki-sdk',
    transformIndexHtml(html) {
      return mode === 'poki' ? html.replace('<head>', '<head>\n  <script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>') : html;
    },
  }],
}));
