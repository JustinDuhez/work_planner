import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Vite's string shorthand would set changeOrigin: true and rewrite Host to the API's
      // address; the API's CSRF Origin check needs the browser's own host (localhost:5173).
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false },
    },
  },
});
