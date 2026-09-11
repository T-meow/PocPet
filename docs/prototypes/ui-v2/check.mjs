// Data and rendering checks only. This does not claim browser layout verification.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('../ui-v2.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const elements=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',style:{setProperty(){}},dataset:{},classList:{remove(){}},focus(){},select(){},querySelector(){return null;},querySelectorAll(){return [];},setAttribute(){},scrollTop:0});return elements.get(id);};
const timers=new Map();let nextTimer=0;
const document={getElementById:element,activeElement:null,documentElement:element('html'),body:element('body'),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
const ctx=vm.createContext({document,window:{scrollTo(){}},navigator:{},console,Date,Math,requestAnimationFrame:fn=>fn(),setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id),setInterval(){},clearInterval(){}});
vm.runInContext(script,ctx,{timeout:10000});
const p=ctx.PocketPrototype,act=(a,v='')=>p.dispatch(a,String(v)),state=()=>p.getState(),ui=()=>p.getUI();
const reset=(preset='daily')=>act('preset-execute',preset);
const assertMarkup=()=>{const content=element('shell').innerHTML+element('overlays').innerHTML;assert(!/\bundefined\b|\bNaN\b|\ufffd/.test(content),'Invalid rendered text');for(const m of content.matchAll(/data-act="([^"]+)"/g))assert(p.actions.includes(m[1]),'Missing action '+m[1]);};
const pages=['home','garden','schedule','focus','cards','gacha','achievements','dreams','settings','roles','year','preview','recovery'];
for(const lang of ['zh','en'])for(const edition of ['standard','bilibili']){p.changeSetting('language',lang);p.changeSetting('edition',edition);for(const page of pages){act('route',page);assertMarkup();}for(const tab of ['profile','appearance','save','share','updates','help']){act('route','settings');act('settings-tab',tab);assertMarkup();}for(const modal of ['menu','notifications','work-dialog','exchange-dialog','tools','skills','probabilities','gacha-history','cg','trophies','save-export','import-preview','mod-import','author','video','birthday-gift','help-gift','announcement']){act(modal);assertMarkup();act('close');}for(const mode of ['bag','shop']){act('storage',mode);for(const cat of ['all','food','care','item','garden']){act('category',cat);for(const item of p.data.items.filter(x=>mode==='bag'||x.shop)){act('select-item',item.id);assertMarkup();}}act('close');}}
p.changeSetting('language','zh');p.changeSetting('edition','standard');reset();
assert.equal(p.data.items.length,33);assert.equal(p.data.achievements.length,96);
assert.equal(p.data.pool.reduce((v,r)=>v+r.weight,0),100000);assert.equal(p.data.heartPool.reduce((v,r)=>v+r.weight,0),100000);
// Purchases -> bag -> feeding, with an exact ledger and an idempotent wish claim.
let coins=state().coins,owned=state().inventory.bento;
act('storage','shop');act('category','food');act('select-item','bento');act('quantity','10');assert.equal(act('transact'),true);assert.equal(state().coins,coins-235);assert.equal(state().inventory.bento,owned+10);
act('switch-storage','bag');act('select-item','bento');act('quantity','5');assert.equal(act('transact'),true);assert.equal(state().inventory.bento,owned+5);assert.equal(state().wish,1);
act('wish');coins=state().coins;act('wish');assert.equal(state().coins,coins);
act('switch-storage','shop');act('select-item','emergency_biscuit');act('quantity','max');act('transact');coins=state().coins;owned=state().inventory.emergency_biscuit;act('transact');assert.equal(state().coins,coins);assert.equal(state().inventory.emergency_biscuit,owned);
act('select-item','bento');state().coins=0;owned=state().inventory.bento;assert.equal(act('transact'),false);assert.equal(state().inventory.bento,owned);
// Plant -> care -> mature -> harvest; locked/withered actions retain all five plots.
reset();act('route','garden');act('select-plot','2');owned=state().inventory.fruit_tree_sapling;assert.equal(act('plant','fruit_tree'),true);assert.equal(state().inventory.fruit_tree_sapling,owned-1);act('water');const remaining=state().garden[2].seconds;act('water');assert.equal(state().garden[2].seconds,remaining);p.advanceSeconds(remaining);owned=state().inventory.apple;assert.equal(act('harvest'),true);assert.equal(state().inventory.apple,owned+3);assert.equal(act('harvest'),false);
state().coins=40000;act('select-plot','4');act('unlock-plot');coins=state().coins;act('close');assert.equal(state().coins,coins);assert.equal(state().garden[4].state,'locked');act('unlock-plot');act('confirm-execute');assert.equal(state().garden[4].state,'empty');act('select-plot','3');act('clear-plot');act('confirm-execute');assert.equal(state().garden[3].state,'empty');assert.equal(state().garden.length,5);
// Scheduled reward settles once, and cancelling a confirmation keeps the activity.
reset();act('route','schedule');act('start-schedule','0');const energy=state().stats.energy;act('cancel-schedule');act('close');assert(state().schedule);p.advanceSeconds(45*60);assert(state().schedulePending);coins=state().coins;act('claim-schedule','coins');assert(state().coins>coins);coins=state().coins;assert.equal(act('claim-schedule','coins'),false);assert.equal(state().coins,coins);assert.equal(state().stats.energy,energy);
// Gacha payment is made once, skip settles once; all results enter the ledger.
reset();act('route','gacha');act('payment','tickets');const tickets=state().tickets;act('draw-execute','10');assert.equal(state().tickets,tickets-10);assert.equal(act('draw-execute','10'),false);act('skip-draw');const snapshot=JSON.stringify({coins:state().coins,inventory:state().inventory});act('skip-draw');assert.equal(JSON.stringify({coins:state().coins,inventory:state().inventory}),snapshot);assert.equal(state().gacha.results.length,10);
act('machine','heart');owned=state().inventory.golden_apple;const hearts=state().hearts;act('draw-execute','10');act('skip-draw');assert.equal(state().inventory.golden_apple,owned-10);assert(state().hearts-hearts>=100);
// Dream contributions and completion consume the required resources exactly once.
reset();act('route','dreams');coins=state().coins;owned=state().inventory.golden_apple;assert.equal(act('invest','cooking:rest'),true);assert.equal(state().coins,coins-2000);assert.equal(act('complete-dream','cooking'),true);assert.equal(state().dreams.cooking.stage,1);assert.equal(state().inventory.golden_apple,owned-1);assert.equal(act('complete-dream','cooking'),false);
// Themes cover light and dark accents. Contrast is checked on every generated surface.
for(const color of ['#476b55','#a06c45','#537a99','#88709e','#fff9ca','#ffffff','#111111','#000000','#ff00ff','#00ff00']){p.inputValue('color-hex',color);const pal=p.palette(color);for(const bg of ['paper','surface','tint','selected'])for(const fg of ['ink','muted','accent-text'])assert(p.contrast(pal[fg],pal[bg])>=4.5,`${color} ${fg}/${bg} contrast`);assert(p.contrast(pal.accent,pal['on-accent'])>=4.5);}
const valid=ui().color;p.inputValue('color-hex','#GGGGGG');assert.equal(ui().color,valid);assert(ui().customError);
const envLedger=JSON.stringify(state());for(const weather of ['sunny','cloudy','rainy','breezy'])for(const season of ['spring','summer','autumn','winter']){act('weather',weather);act('season',season);act('route','home');assertMarkup();act('route','garden');assertMarkup();assert.equal(JSON.stringify(state()),envLedger);}
act('select-role','mint');assert.equal(ui().season,'winter');assert.equal(ui().weather,'breezy');reset('end');assert.equal(ui().color,valid);assert.equal(ui().weather,'breezy');assert.equal(ui().season,'winter');
// Local backup restore does not cross into appearance or production saves.
reset();coins=state().coins;act('backup');state().coins=5;act('restore-confirm','0');act('confirm-execute');assert.equal(state().coins,coins);assert.equal(ui().color,valid);assert.equal(p.exportDemo().format,'pocket-ui-prototype-v2');
act('birthday-gift');act('claim-event');owned=state().inventory.birthday_cake;act('birthday-gift');act('claim-event');assert.equal(state().inventory.birthday_cake,owned);
act('long-notice');assert(ui().notice.text.length>60);for(let i=0;i<25;i++)act('long-notice');assert.equal(ui().notices.length,20);act('expand-notice');assert(ui().noticeExpanded);act('dismiss-notice');assert.equal(ui().notice,null);
assert(!/<script[^>]+src=|<link[^>]+href=|fetch\(|localStorage\.|sessionStorage\./.test(html),'Prototype must be offline and isolated');
reset('new');act('route','gacha');act('draw-confirm','10');act('confirm-execute');assert.equal(ui().stack.length,0);assert.equal(element('overlays').innerHTML,'');assert.equal(state().coins,80);
// Completed daily rows disappear; pending rewards remain until actually claimed.
const hasToday=()=>element('shell').innerHTML.includes('id="today-matters"');
reset();assert(hasToday());state().wish=1;act('wish');assert(hasToday());act('select-plot','0');act('harvest');assert(hasToday());
owned=state().inventory.small_bouquet;act('neighbor-visit');assertMarkup();act('neighbor-gift');assert.equal(state().inventory.small_bouquet,owned+1);assert(!hasToday());act('neighbor-gift');assert.equal(state().inventory.small_bouquet,owned+1);
act('trigger-return');assert(hasToday());act('touch');assert(hasToday());act('return-welcome');act('claim-event');assert(!hasToday());
act('start-schedule','0');p.advanceSeconds(45*60);p.render();assert(hasToday());act('claim-schedule','coins');assert(!hasToday());
act('advance','day');assert(hasToday());state().wish=1;p.render();assert(element('shell').innerHTML.includes('小心愿达成，领取奖励'));
// No locked CG appears in covers, the illustration dialog, achievements, or downloads.
const assets=vm.runInContext('ASSETS',ctx),memoryCheck=()=>{for(const role of ['furo','doro','mint'])assert(!element('shell').innerHTML.includes(assets['cg_'+role])&&!element('overlays').innerHTML.includes(assets['cg_'+role]),'Locked CG leaked');};
for(const preset of ['new','daily']){reset(preset);for(const role of ['furo','doro','mint']){act('select-role',role);memoryCheck();assert(element('shell').innerHTML.includes('sticker-cover'));act('cg');memoryCheck();assert.equal(act('download-cg'),false);act('close');}assert.equal(act('claim-achievement','hidden_good_ending_year_1'),false);}
const lockedSave=p.exportDemo();reset('end');for(const role of ['furo','doro','mint']){act('select-role',role);assert(element('shell').innerHTML.includes(assets['cg_'+role]));}
p.restoreData(lockedSave);memoryCheck();state().ageDays=364;state().review.activeDays=199;act('advance','day');assert(state().unlockedCgIds.includes('good_ending_year_1'));
// Review counts follow real actions in the simulation; preview and export share one SVG.
reset('new');const before=JSON.parse(JSON.stringify(state().review));act('touch');act('storage','bag');act('category','food');act('select-item','emergency_biscuit');act('transact');act('close');act('advance','focus');
assert.equal(state().totalCare,2);assert.equal(state().review.itemsUsed,before.itemsUsed+1);assert.equal(state().review.focusCount,before.focusCount+1);assert.equal(state().review.focusMinutes,25);
const svg=vm.runInContext('yearReviewSvg()',ctx);for(const label of ['照顾时刻','物品使用','花园收获','完成日程','专注时光','成长的足迹'])assert(svg.includes(label));for(const role of ['furo','doro','mint'])assert(!svg.includes(assets['cg_'+role]));
act('route','year');assert(element('shell').innerHTML.includes(encodeURIComponent(svg)));act('image-preview','year');assert(element('overlays').innerHTML.includes(encodeURIComponent(svg)));
let exportSource,drawn=false,downloaded=false;ctx.Image=class{set src(value){exportSource=value;this.onload();}};
document.createElement=tag=>tag==='canvas'?{width:0,height:0,getContext:()=>({drawImage(){drawn=true;}}),toDataURL:()=> 'data:image/png;base64,demo'}:{click(){downloaded=true;}};
await act('download-card','year');assert(drawn&&downloaded);assert.equal(exportSource,'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg));
// Restored original entries and everyday task types.
reset();for(const lang of ['zh','en']){p.changeSetting('language',lang);for(const action of ['neighbor-visit','status-details','choose-backup','share-save','edition-notice','cloud-reminder','release-notes','share-app','skills','trophies']){act(action);assertMarkup();act('close');}}
p.changeSetting('language','zh');act('route','schedule');assert(!element('shell').innerHTML.includes('data-act="neighbor-gift"'));assert(!element('shell').innerHTML.includes('data-act="neighbor-visit"'));
for(const kind of ['feed','clean','play','touch','work']){reset();p.changeSetting('wish-kind',kind);act('wish');if(kind==='feed'){act('select-item','bento');act('transact');act('close');}if(kind==='work')act('work');assert.equal(state().wish,1,kind+' wish progress');coins=state().coins;act('wish');assert.equal(state().coins-coins,{feed:36,clean:36,play:36,touch:32,work:48}[kind]);coins=state().coins;act('wish');assert.equal(state().coins,coins);}
reset();for(const i of [0,1,2]){assert.equal(act('start-schedule',i),true);p.advanceSeconds(state().schedule.remaining);act('claim-schedule','coins');assert.equal(act('start-schedule',i),false);}assert(state().dailyTickets.granted.includes('partner_schedule'));assert.equal(state().scheduleToday,3);
const savedTickets=state().tickets;act('claim-schedule','coins');assert.equal(state().tickets,savedTickets);reset('new');assert.equal(state().scheduleBoardCount,3);reset('end');assert.equal(state().scheduleBoardCount,5);act('trophies');assert.equal((element('overlays').innerHTML.match(/class="trophy /g)||[]).length,12);assert(element('overlays').innerHTML.includes('钻石'));
// Legacy contributions persist; large investments and bulk exchanges can be cancelled.
coins=state().coins;act('invest-request','legacy:10000');act('close');assert.equal(state().coins,coins);act('invest-request','legacy:10000');act('confirm-execute');assert.equal(state().legacy.invested,10000);assert.equal(state().coins,coins-10000);
vm.runInContext('globalThis.nextLegacyCost=legacyCost()',ctx);act('legacy-invest',ctx.nextLegacyCost-state().legacy.invested);coins=state().coins;const legacy=state().legacy.level;act('legacy-confirm');act('confirm-execute');assert.equal(state().coins,coins);assert.equal(state().legacy.level,legacy+1);assert.equal(state().legacy.invested,0);
owned=state().inventory.golden_apple;act('gold-exchange-request','10');act('close');assert.equal(state().inventory.golden_apple,owned);act('gold-exchange-request','all');act('confirm-execute');assert.equal(state().inventory.golden_apple,0);assert.equal(act('gold-exchange','1'),false);
// File and pasted imports share validation, preview, backup, and undo.
reset();const imported=p.exportDemo();imported.state.coins=4321;p.inputValue('import-demo-text',JSON.stringify(imported));coins=state().coins;act('import-pasted');act('close');assert.equal(state().coins,coins);act('import-pasted');act('apply-import');assert.equal(state().coins,4321);assert(state().importRollback);act('rollback-import');act('confirm-execute');assert.equal(state().coins,coins);
p.inputValue('import-demo-text','{"format":"game-save"}');assert.equal(act('import-pasted'),false);assert.equal(state().coins,coins);
vm.runInContext('downloadText=(filename,body,type)=>{globalThis.lastDownload={filename,body,type};}',ctx);act('backup');const backupCoins=state().coins;state().coins=9;act('export-backup','0');assert.equal(JSON.parse(ctx.lastDownload.body).state.coins,backupCoins);act('export-damaged');assert(ctx.lastDownload.filename.includes('damaged'));
const oldTarget=state().backupTarget;act('choose-backup');p.inputValue('backup-candidate','changed.json');act('close');assert.equal(state().backupTarget,oldTarget);act('choose-backup');p.inputValue('backup-candidate','changed.json');act('select-backup');assert.equal(state().backupTarget,'changed.json');act('expire-backup');act('authorize-backup');assert.equal(state().backupFileStatus,'ready');
reset();act('storage','bag');act('category','all');act('select-item','golden_apple');owned=state().inventory.golden_apple;act('transact');act('close');assert.equal(state().inventory.golden_apple,owned);act('transact');act('confirm-execute');assert.equal(state().inventory.golden_apple,owned-1);assert(state().suppressAppleConfirm);
act('route','home');state().stats.cleanliness=1;act('care','sleep');act('close');assert.equal(state().sleeping,false);act('care','sleep');act('confirm-execute');assert.equal(state().sleeping,true);assert.equal(act('focus-toggle'),false);
console.log('PASS: original page and ledger checks, neighbor tasks, five wish types, daily activity tickets, trophy tiers, legacy contributions, bulk exchange, import/undo/export, and guarded care actions. Browser layout and image rendering are NOT tested.');
