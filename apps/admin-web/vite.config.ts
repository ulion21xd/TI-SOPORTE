import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = resolve(appRoot, '../..');

export default defineConfig({
  root: appRoot,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: { allow: [workspaceRoot] },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
