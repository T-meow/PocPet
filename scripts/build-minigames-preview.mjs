import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({
  configFile: false, root, plugins: [react()], logLevel: 'warn',
  define: { 'process.env.NODE_ENV': '"production"' },
  build: { write: false, target: 'es2017', cssCodeSplit: false, minify: 'esbuild',
    lib: { entry: resolve(root, 'src/minigames/preview.tsx'), name: 'PocPetMiniGamesPreview', formats: ['iife'] },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output || []);
const js = outputs.filter(item => item.type === 'chunk').map(item => item.code).join('\n');
const css = outputs.filter(item => item.type === 'asset' && item.fileName.endsWith('.css')).map(item => String(item.source)).join('\n');
if (!js || !css) throw new Error('Missing preview script or styles.');
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f7f5ee"><title>一起玩一会儿 · PocPet</title><style>html,body{margin:0;background:#f7f5ee}${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="minigames-root"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
const target = resolve(root, 'output/prototypes/relax-games.html');
await mkdir(dirname(target), { recursive: true });
await writeFile(target, html, 'utf8');
console.log(`Generated output/prototypes/relax-games.html (${Math.ceil(Buffer.byteLength(html) / 1024)} KiB, offline).`);
console.log('Preview: http://127.0.0.1:5173/output/prototypes/relax-games.html');
