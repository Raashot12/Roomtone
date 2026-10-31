import React from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './main.jsx';

const root = document.getElementById('root');
const path = window.location.pathname.replace(/\/+$/, '');
const initialView = path === '/extract-audio-from-video' ? 'extract' : 'enhance';
const app = <App initialView={initialView} showLoader={root?.dataset.ssr !== 'true'} />;

if (root?.dataset.ssr === 'true') {
  hydrateRoot(root, app);
} else if (root) {
  createRoot(root).render(app);
}
