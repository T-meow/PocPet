import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const paths = {
  furo: 'src/assets/pet/compressed/pet_idle_sit.png',
  doro: 'src/mods/mod-doro/pet/content.png', mint: 'src/mods/mod-mint/pet/content.png',
  apple: 'src/assets/icon/item_apple.png', carrot: 'src/assets/icon/item_carrot.png',
  tomato: 'src/assets/icon/item_tomato.png', egg: 'src/assets/icon/item_egg.png',
  rice: 'src/assets/icon/item_rice.png', flour: 'src/assets/icon/item_flour.png',
  omelet: 'src/assets/icon/item_dish_carrot_omelet.png', pudding: 'src/assets/icon/item_dish_fruit_pudding.png',
  golden_apple: 'src/assets/icon/item_golden_apple.png', wet_wipes: 'src/assets/icon/item_wet_wipes.png',
  flowers: 'src/assets/icon/icon_flowers.png',
};
const assets = Object.fromEntries(Object.entries(paths).map(([id, file]) => [id, 'data:image/png;base64,' + fs.readFileSync(path.join(root, file)).toString('base64')]));
const read = file => fs.readFileSync(path.join(dir, file), 'utf8');
const script = 'const ASSETS = ' + JSON.stringify(assets) + ';\n' + ['model.js', 'art.js', 'ui.js'].map(read).join('\n');
new vm.Script(script, { filename: 'farm.html' });
const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f6f5ec"><title>Pocket · 一方小院，一点收获</title><style>${read('ui.css')}</style></head>
<body><div id="app"></div><dialog id="dialog" aria-labelledby="modal-title"></dialog><div id="toast" role="status" aria-live="polite"></div><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>\n`;
const target = path.join(dir, '../farm.html'); fs.writeFileSync(target, html, 'utf8');
console.log(JSON.stringify({ output: target, bytes: Buffer.byteLength(html), embeddedAssets: Object.keys(assets).length, script: 'valid' }));
