import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/zombie-shooter/',
  server: {
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
}); 
