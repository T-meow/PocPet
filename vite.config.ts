import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const version = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string;
const revision = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

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

export default defineConfig(({ mode }) => {
  const build = { version, edition: mode === 'toy' ? 'bilibili' : 'standard', revision };
  return {
    base: './',
    cacheDir: mode === 'toy' ? 'node_modules/.vite-toy' : 'node_modules/.vite',
    server: { watch: { ignored: ['**/src-tauri/**', '**/release/**', '**/test-results/**', '**/dist/**', '**/dist-toy/**'] } },
    build: { outDir: mode === 'toy' ? 'dist-toy' : 'dist', manifest: 'asset-manifest.json' },
    define: { __APP_BUILD__: JSON.stringify(build) },
    plugins: [react(), ...(mode === 'toy' ? [toySdkPlugin()] : []), {
      name: 'pocpet-build-info',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify(build) });
      },
    }],
  };
});
