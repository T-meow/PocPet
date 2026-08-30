import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const toySdkPlugin = (): Plugin => ({
  name: 'pocpet-toy-sdk',
  transformIndexHtml: {
    order: 'pre',
    handler: () => [{
      tag: 'script',
      attrs: { src: '//s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js' },
      injectTo: 'head',
    }],
  },
});

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'toy' ? [toySdkPlugin()] : [])],
}));
