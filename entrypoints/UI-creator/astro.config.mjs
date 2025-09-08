// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()]
    // server: {
    //   proxy: {
    //     '/api': {
    //       target: 'https://stickit-avatar-creator-api.ui-wow-enabler-account.workers.dev',
    //       changeOrigin: true,
    //       rewrite: (path) => path.replace(/^\/api/, '')
    //     }
    //   }
    // }
  },

  integrations: [react()]
});