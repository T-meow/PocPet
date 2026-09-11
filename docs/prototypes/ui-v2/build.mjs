import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const zh = JSON.parse(read('src/i18n/zh-CN.json'));
const en = JSON.parse(read('src/i18n/en-US.json'));
const old = read('docs/prototypes/home-grid.html');
const oldAssets = JSON.parse(old.match(/const ASSETS = (\{[\s\S]*?\});\s*const ITEMS/)[1]);
const iconCode = old.match(/const ICONS = (\{[\s\S]*?\n    \});\s*const icon/)[1];
const icons = vm.runInNewContext('(' + iconCode + ')');
Object.assign(icons, {
  palette:'<circle cx="12" cy="12" r="9"/><path d="M21 12c0 5-8-1-8 4s-5 5-7 3"/><circle cx="7" cy="10" r=".8"/><circle cx="11" cy="6" r=".8"/><circle cx="16" cy="8" r=".8"/>',
  bell:'<path d="M6 9a6 6 0 0 1 12 0c0 7 3 6 3 9H3c0-3 3-2 3-9Zm4 12h4"/>',
  cloud:'<path d="M6 19a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11H6Z"/>',
  rain:'<path d="M5 14a4 4 0 0 1 0-8 6 6 0 0 1 11-1 5 5 0 0 1 2 9M7 17l-1 4m6-4-1 4m6-4-1 4"/>',
  wind:'<path d="M2 8h14a3 3 0 1 0-3-3M2 12h18a3 3 0 1 1-3 3M2 16h7a3 3 0 1 1-3 3"/>',
  book:'<path d="M12 5C8 1 3 3 2 4v16c4-3 7-2 10 0 3-2 6-3 10 0V4c-1-1-6-3-10 1Zm0 0v15"/>',
  chef:'<path d="M7 20h10v-8c8 1 7-10 0-8-2-5-8-5-10 0-7-2-8 9 0 8v8Zm0-4h10"/>',
  exercise:'<path d="m3 7 14 14M7 3l14 14M1 9l8-8m6 22 8-8M7 7l10 10"/>',
  save:'<path d="M3 3h15l3 3v15H3V3Zm4 0v6h10V3M7 21v-8h10v8"/>',
  upload:'<path d="M3 15v6h18v-6M12 17V2m-6 6 6-6 6 6"/>',
  download:'<path d="M3 15v6h18v-6M12 2v15m-6-6 6 6 6-6"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  refresh:'<path d="M20 9a8 8 0 1 0 0 7M20 3v6h-6"/>',
  play:'<path d="m8 3 13 9-13 9V3Z"/>',
  pause:'<path d="M6 3h4v18H6V3Zm8 0h4v18h-4V3Z"/>',
  volume:'<path d="m3 9 5 0 5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  lock:'<rect x="4" y="10" width="16" height="12" rx="3"/><path d="M7 10V6a5 5 0 0 1 10 0v4m-5 5v3"/>',
  trash:'<path d="M3 6h18M9 6V2h6v4M5 6l1 16h12l1-16M9 10v8m6-8v8"/>',
  back:'<path d="M21 12H3m6-6-6 6 6 6"/>',
  image:'<rect x="2" y="3" width="20" height="18" rx="3"/><circle cx="8" cy="9" r="2"/><path d="m3 18 5-5 4 4 5-7 5 7"/>',
  sliders:'<path d="M4 2v6m0 4v10M12 2v12m0 4v4M20 2v3m0 4v13M1 8h6v4H1V8Zm8 6h6v4H9v-4Zm8-9h6v4h-6V5Z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
});
const assets={...oldAssets};
const embed=(id,p)=>assets[id]='data:image/png;base64,'+fs.readFileSync(path.join(root,p)).toString('base64');
embed('golden_apple','src/assets/icon/item_golden_apple.png');
assets.birthday_cake=assets.strawberry_cake;
for(let i=1;i<=5;i++)embed('tree'+i,'src/assets/tree'+i+'.png');
embed('cg_furo','src/assets/CG1.png');
for(const role of ['doro','mint']) {
  for(const [key,file] of Object.entries({idle:'content',happy:'happy',sleep:'sleeping',eat:'eat_cookie',bath:'bath',work:'work_food'}))embed(role+'_'+key,`src/mods/mod-${role}/pet/${file}.png`);
  embed('cg_'+role,`src/mods/mod-${role}/cg/good_ending_year_1.png`);
}
for(const pose of ['idle','happy','sleep','eat','bath','work'])assets['furo_'+pose]=assets['pet_'+pose];
const itemSource=read('src/core/items.ts');
const items=[...itemSource.slice(itemSource.indexOf('export const shopItems:'),itemSource.indexOf('export const inventoryItems:')).matchAll(/\{\s*id: '([^']+)',[\s\S]*?kind: '([^']+)',\s*price: (\d+),\s*effect: (\{[^}]*\})/g)].map(m=>({id:m[1],kind:m[2],price:+m[3],effect:JSON.parse(m[4].replace(/(\w+):/g,'"$1":')),shop:!['golden_apple','birthday_cake'].includes(m[1]),zh:zh.pet.shop.items[m[1]],en:en.pet.shop.items[m[1]]}));
const achSource=read('src/core/achievements.ts');
const achievements=[...achSource.matchAll(/^  \{ id: '([^']+)', category: '([^']+)', rarity: '([^']+)', target: ([^,]+),.*reward: (.*) \},?$/gm)].map(m=>({id:m[1],category:m[2],rarity:m[3],target:Number(m[4])||({garden_tree_catalogue:5,schedule_all_categories:4,schedule_long_all_categories:4,shop_item_collector:31,omnivore:11}[m[1]]||10),coins:+(m[5].match(/coins: (\d+)/)?.[1]||0),hearts:+(m[5].match(/hearts: (\d+)/)?.[1]||0),item:m[5].match(/itemId: '([^']+)'/)?.[1],amount:+(m[5].match(/amount: (\d+)/)?.[1]||1),effect:m[5].match(/(workCoinBonus|dailyStipendCoins|extraHeartChancePercent|gardenExtraDropChancePercent|careStatBonus|pomodoroCoinBonus|partnerScheduleExtraRewardChancePercent|dailyLoginItemBonus): (\d+)/)?.slice(1),cg:m[1]==='hidden_good_ending_year_1',zh:zh.pet.achievements.definitions[m[1]],en:en.pet.achievements.definitions[m[1]]})).filter(a=>a.zh);
const gachaSource=read('src/core/goldenAppleGacha.ts');
const pool=[];
const rewardBlock=gachaSource.slice(gachaSource.indexOf('export const goldenAppleGachaRewards:'),gachaSource.indexOf('const heartReward'));
for(const m of rewardBlock.matchAll(/coinReward\((\d+), (\d+), '([^']+)'\)/g))pool.push({kind:'coins',amount:+m[1],weight:+m[2],rarity:m[3]});
for(const m of rewardBlock.matchAll(/itemReward\('[^']+', '([^']+)', (\d+), (\d+), '([^']+)'/g))pool.push({kind:'item',item:m[1],amount:+m[2],weight:+m[3],rarity:m[4]});
const heartPool=[...gachaSource.matchAll(/heartReward\((\d+), (\d+), '([^']+)'\)/g)].map(m=>({kind:'hearts',amount:+m[1],weight:+m[2],rarity:m[3]}));
const room=old.match(/<svg class="room"[\s\S]*?<\/svg>/)[0].replaceAll('#e7eddc','var(--env-wall)').replaceAll('#e1e8d3','var(--env-wall)').replaceAll('#c5d5b4','var(--env-leaf)').replaceAll('#b7caa1','var(--env-leaf)').replaceAll('#a8ba93','var(--env-leaf)').replaceAll('#a0b48b','var(--env-leaf)');
const data={items,achievements,pool,heartPool,room,icons,copy:{zh:{weather:zh.pet.weather,season:zh.pet.season,dreams:zh.ui.classicEndgame.projects,schedule:zh.ui.partnerSchedule,trophies:zh.ui.classicEndgame.trophies},en:{weather:en.pet.weather,season:en.pet.season,dreams:en.ui.classicEndgame.projects,schedule:en.ui.partnerSchedule,trophies:en.ui.classicEndgame.trophies}}};
if(items.length!==33||achievements.length<90||pool.length!==27||heartPool.length!==9)throw new Error('Unexpected source data counts '+JSON.stringify([items.length,achievements.length,pool.length,heartPool.length]));
const css=fs.readFileSync(path.join(dir,'ui.css'),'utf8');
const js=['app.js','pages.js','memories.js','extras.js','actions.js'].map(file=>fs.readFileSync(path.join(dir,file),'utf8')).join('\n');
const inline='const ASSETS='+JSON.stringify(assets)+';\nconst DATA='+JSON.stringify(data)+';\n'+js;
new vm.Script(inline,{filename:'ui-v2.html'});
const html='<!doctype html>\n<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#f6f7f0"><title>Pocket · 我们的小窝</title><style>\n'+css+'\n</style></head><body><div id="shell"></div><div id="overlays"></div><div id="notice" aria-live="polite"></div><script>\n'+inline.replace(/<\/script/gi,'<\\/script')+'\n</script></body></html>\n';
fs.writeFileSync(path.join(dir,'../ui-v2.html'),html,'utf8');
console.log(JSON.stringify({output:'docs/prototypes/ui-v2.html',items:items.length,achievements:achievements.length,assets:Object.keys(assets).length,MiB:(Buffer.byteLength(html)/1024/1024).toFixed(2),script:'valid'}));
