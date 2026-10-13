import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
