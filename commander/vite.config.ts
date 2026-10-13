import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  publicDir: path.resolve(__dirname, '../public'),
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5174
  },
  preview: {
    host: '127.0.0.1',
    port: 4174
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts'
  }
});

