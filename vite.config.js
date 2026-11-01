import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function prerenderHomePage() {
  return {
    name: 'roomtone-prerender-home-page',
    apply: 'build',
    transformIndexHtml(html) {
      const homeMarkup = readFileSync(resolve(process.cwd(), '.seo-generated/home.html'), 'utf8');
      return html.replace('<div id="root"></div>', `<div id="root" data-ssr="true">${homeMarkup}</div>`);
    },
  };
}

export default defineConfig({
  assetsInclude: ['**/*.bin'],
  plugins: [
    prerenderHomePage(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Roomtone Voice Workspace',
        short_name: 'Roomtone',
        description: 'Clean up voice recordings in your browser with Roomtone.',
        lang: 'en',
        theme_color: '#17352d',
        background_color: '#f4f6f2',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,bin,wasm,txt,webmanifest}'],
        globIgnores: ['**/wasmpeg/**'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/wasmpeg\/(cpu\.js|cpu\.wasm)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'roomtone-mp4-decoder',
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
});
