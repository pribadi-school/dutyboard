import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `npm run dev` runs in demo mode (data in this browser). `npm run dev:php`
// (mode "php", see .env.php) talks to the real PHP API: start it first with
// `npm run php` (PHP's built-in server on :8000); /api is proxied there.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
});
