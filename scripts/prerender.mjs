import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';

const root = process.cwd();
const outputDirectory = resolve(root, '.seo-generated');
const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.js'),
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { App } = await server.ssrLoadModule('/src/main.jsx');
  await mkdir(outputDirectory, { recursive: true });

  const pages = [
    ['home.html', 'enhance'],
    ['extract.html', 'extract'],
  ];

  for (const [filename, initialView] of pages) {
    const markup = renderToString(React.createElement(App, { initialView, showLoader: false }));
    await writeFile(resolve(outputDirectory, filename), markup, 'utf8');
  }
} finally {
  await server.close();
}
