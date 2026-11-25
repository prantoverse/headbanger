import { defineConfig } from 'vite';
// relative base so the same build works on Vercel (/) and GitHub Pages (/headbanger/)
export default defineConfig({ base: './', build: { target: 'es2022', chunkSizeWarningLimit: 1200 } });
