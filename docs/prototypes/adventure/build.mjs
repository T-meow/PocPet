import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../../..');
const assets={};
for(const [id,file] of Object.entries({
  furo:'src/assets/pet/compressed/pet_idle_sit.png',
  furo_happy:'src/assets/pet/compressed/pet_happy.png',
  doro:'src/mods/mod-doro/pet/content.png',
  mint:'src/mods/mod-mint/pet/content.png',
  apple:'src/assets/icon/item_apple.png',
  bento:'src/assets/icon/item_bento.png',
}))assets[id]='data:image/png;base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');
const script='const ASSETS='+JSON.stringify(assets)+';\n'+['model.js','art.js','ui.js'].map(read).join('\n');
new vm.Script(script,{filename:'adventure.html'});
const html=`<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f7f7ef"><title>Pocket · 和你去远方</title><style>${read('ui.css')}</style></head>
<body><div id="app"></div><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div><script>${script.replace(/<\/script/gi,'<\\/script')}</script></body></html>\n`;
const target=path.join(dir,'../adventure.html');fs.writeFileSync(target,html,'utf8');
console.log(JSON.stringify({output:target,bytes:Buffer.byteLength(html),assets:Object.keys(assets).length,script:'valid'}));
