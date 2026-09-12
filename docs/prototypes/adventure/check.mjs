// Run prototype behavior and markup checks without a browser or production save.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),postcss=require('postcss');
const read=file=>fs.readFileSync(new URL(file,import.meta.url),'utf8');
const context=vm.createContext({console});vm.runInContext(read('model.js'),context);
const M=context.AdventureModel;
const fresh=preset=>M.createState(preset);
const go=(s,node,choice)=>{assert(M.moveTo(s,node),`move ${node}`);assert(M.resolveNode(s,choice),`choice ${choice}`);};
const home=s=>{assert(M.finishExploration(s));assert(M.claimResult(s));};
const ledger=s=>JSON.stringify({coins:s.coins,hearts:s.hearts,energy:s.energy,meals:s.meals,inventory:s.inventory,regions:s.regions});
// Low-level access, path choice, exact cost, early return, unused food, and idempotence.
let s=fresh('new'),before=ledger(s);
assert(!M.startExploration(s,{region:'hills'}));assert.equal(ledger(s),before);
assert(M.startExploration(s,{region:'valley',meal:true}));assert.equal(s.coins,2340);assert.equal(s.energy,92);assert.equal(s.meals,5);
assert(!M.startExploration(s,{region:'valley'}));assert(!M.startExpedition(s,{region:'valley'},0));
assert(!M.moveTo(s,'story'));go(s,'gather','gather');
assert(!M.resolveNode(s,'gather'));assert(!M.eatMeal({...s,trip:{...s.trip,meal:false}}));
home(s);assert.equal(s.meals,6);assert.equal(s.hearts,360);assert.equal(s.regions.valley.explorations,0);assert.equal(s.inventory['野果'],2);assert.equal(s.regions.valley.landmarks.length,1);
before=ledger(s);assert(!M.claimResult(s));assert(!M.finishExploration(s));assert.equal(ledger(s),before);
// Ordinary completion unlocks the next region from three actual landmarks.
s=fresh('new');assert(M.startExploration(s,{region:'valley',meal:true}));
assert(M.eatMeal(s));assert.equal(s.trip.steps,9);assert(!M.eatMeal(s));
go(s,'ridge','observe');go(s,'bridge','rope');go(s,'lookout','landscape');assert(s.regions.hills.unlocked);
go(s,'story','solve');assert(!M.availableNodes(s).includes('battle'));assert(s.regions.valley.base);go(s,'camp','rest');home(s);
assert.equal(s.hearts,414);assert.equal(s.meals,5);assert.equal(s.regions.valley.explorations,1);assert.equal(s.inventory['纪念种子'],1);
// Lens discovery creates a usable shortcut, including subsequent trips and expeditions.
s=fresh();assert(M.startExploration(s,{region:'valley',tool:'lens'}));go(s,'gather','inspect');assert(s.regions.valley.shortcut);assert(M.availableNodes(s).includes('story'));go(s,'story','solve');home(s);
assert(M.startExploration(s,{region:'valley'}));go(s,'gather','gather');assert(M.availableNodes(s).includes('story'));go(s,'story','solve');home(s);assert.equal(s.inventory['纪念种子'],1);
assert(M.startExpedition(s,{region:'valley',route:'shortcut',minutes:120},1000));assert(s.trip.fixedItems.every(x=>x==='蘑菇'));assert(M.finishExpedition(s,s.trip.end));assert(M.claimResult(s));
// One successful battle, declared enemy intent, bounded normal strategy and one reward.
s=fresh();assert(!M.startExpedition(s,{region:'valley',goal:'challenge'},0));
assert(M.startExploration(s,{region:'valley'}));go(s,'gather','gather');go(s,'bridge','rope');go(s,'story','solve');go(s,'battle','challenge');
assert.equal(s.coins,2310);assert(!M.resolveNode(s,'challenge'));
for(const action of ['guard','skill','guard','attack'])assert(M.battleAction(s,action));
assert(s.trip.battleWon);assert.equal(s.trip.battle,null);assert(!M.battleAction(s,'attack'));assert(!s.regions.valley.battle);
home(s);assert(s.regions.valley.battle);assert.equal(s.hearts,453);assert.equal(s.coins,2435);
assert(M.startExpedition(s,{region:'valley',goal:'challenge'},0));assert(M.finishExpedition(s,s.trip.end));assert(M.claimResult(s));
// Failure and retreat both retain normal findings and omit the victory bonus.
for(const retreat of [false,true]){
  s=fresh();assert(M.startExploration(s,{region:'valley'}));go(s,'gather','gather');go(s,'bridge','rope');go(s,'story','solve');go(s,'battle','challenge');
  if(retreat)assert(M.battleAction(s,'retreat'));
  else {for(let i=0;i<60&&s.trip.battle;i++)M.battleAction(s,'guard');assert.equal(s.trip.battle,null);}
  assert(!s.trip.battleWon);home(s);assert.equal(s.hearts,422);assert(!s.regions.valley.battle);assert.equal(s.inventory['野果'],2);
}
// Fixed expedition outcomes, exact node boundaries, pre-node recall, and net-cost refunds.
for(const minutes of [30,120,360])for(const meal of [false,true])for(const ratio of [0,.2,.5,1,1.5]){
  s=fresh();const start=100000;
  assert(M.startExpedition(s,{region:'valley',minutes,meal,goal:'sightsee'},start));
  const t=JSON.parse(JSON.stringify(s.trip)),elapsed=start+(t.end-start)*ratio;
  const preview=M.recallPreview(s,elapsed),paidCoins=2400-s.coins,paidEnergy=100-s.energy;
  assert(preview.refundCoins<=paidCoins);assert(preview.refundEnergy<=paidEnergy);
  assert(M.finishExpedition(s,elapsed));const result=JSON.parse(JSON.stringify(s.pending));
  assert(!M.startExpedition(s,{region:'valley'},elapsed));assert(!M.finishExpedition(s,elapsed));
  if(ratio<1){assert.equal(result.hearts,0);assert.equal(result.findings.length,0);assert.equal(result.minutes,0);}
  else {assert.equal(result.hearts,M.expeditionQuote(fresh(),minutes,meal).hearts);assert.equal(result.minutes,minutes);}
  assert.equal(Object.values(result.items).reduce((a,b)=>a+b,0),preview.nodes);
  assert(M.claimResult(s));assert.equal(s.coins,2400-paidCoins+result.coins+preview.refundCoins);assert.equal(s.energy,100-paidEnergy+preview.refundEnergy);assert.equal(s.meals,6-(meal?1:0));
  assert.equal(s.regions.valley.trips,ratio>=1?1:0);assert.equal(s.regions.valley.landmarks.length,0);
  before=ledger(s);assert(!M.claimResult(s));assert.equal(ledger(s),before);
}
s=fresh();assert(M.startExpedition(s,{region:'valley',minutes:120},0));assert.equal(M.expeditionProgress(s.trip,40*60000-1).nodes,0);assert.equal(M.expeditionProgress(s.trip,40*60000).nodes,1);
const promised=JSON.stringify(s.trip.fixedItems);M.expeditionProgress(s.trip,80*60000);assert.equal(JSON.stringify(s.trip.fixedItems),promised);assert(M.advance(s,120*60000));assert(!M.advance(s,1000000000));assert.equal(s.regions.valley.trips,0);assert(M.claimResult(s));
// Idle-only bases, finite repairs, shared recollections and manual/expedition separation.
s=fresh('roam');assert(M.repairBase(s,'valley'));assert.equal(s.regions.valley.repair,1);assert(M.repairBase(s,'valley'));before=ledger(s);assert(!M.repairBase(s,'valley'));assert.equal(ledger(s),before);
assert(M.meetNeighbor(s,'valley'));const memories=s.memories.length;assert(!M.meetNeighbor(s,'valley'));assert.equal(s.memories.length,memories);
assert(M.startExpedition(s,{region:'valley'},0));assert(!M.repairBase(s,'hills'));assert(!M.meetNeighbor(s,'hills'));
s=fresh();for(let i=0;i<4;i++){assert(M.startExpedition(s,{region:'valley',goal:'sightsee'},0));assert(M.advance(s,30*60000));assert(M.claimResult(s));if(i===1)assert(!s.regions.hills.unlocked);}
assert(s.regions.hills.unlocked);assert.equal(s.regions.valley.findings.length,4);assert.equal(s.regions.valley.landmarks.length,0);assert(!s.regions.valley.base);
// Generated standalone artifact and all page branches render without external dependencies.
const html=read('../adventure.html'),script=html.match(/<script>([\s\S]*)<\/script>/)[1];
assert(!/fetch\(|localStorage|sessionStorage|<script[^>]+src=|<link[^>]+href=|@import/.test(html));
assert.equal((html.match(/data:image\/png;base64,/g)||[]).length,6);
const elements=new Map(),listeners=new Map();
const element=id=>{if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',style:{},classList:{add(){},remove(){},toggle(){}},querySelector(selector){if(id==='app'&&selector==='.expedition-form .form-section'&&this.innerHTML.includes('expedition-form'))return {insertAdjacentHTML:(_,markup)=>{this.innerHTML=this.innerHTML.replace('<div class="form-section">',markup+'<div class="form-section">');}};return null;},querySelectorAll(){return [];},focus(){},getAttribute(){return null;}});return elements.get(id);};
const document={getElementById:element,activeElement:null,body:element('body'),querySelectorAll(){return [];},addEventListener(type,cb){listeners.set(type,cb);}};
const ctx=vm.createContext({document,window:{scrollTo(){}},console,Date,Math,setInterval(){},setTimeout(){},clearTimeout(){}});
vm.runInContext(script,ctx,{timeout:10000});const P=ctx.AdventurePrototype;
const actions=new Set();const markup=()=>{
  const rendered=element('app').innerHTML+element('modal-root').innerHTML;
  assert(!/\bundefined\b|\bNaN\b|\ufffd/.test(rendered),'invalid markup');
  for(const m of rendered.matchAll(/data-action="([^"]+)"/g))actions.add(m[1]);
  assert(rendered.includes('冒险原型'));assert(rendered.includes('data-action="page"'));
};
const act=(action,value='')=>{const result=P.dispatch(action,value);markup();return result;};
for(const preset of ['new','challenge','roam']){
  act('preset',preset);act('confirm');
  for(const r of M.REGIONS){act('region',r.id);for(const page of ['map','expedition','base','journal']){act('page',page);for(const book of ['landmarks','products','findings','memories']){act('book',book);act('entry','0');}}}
}
act('preset','challenge');act('cancel');act('preset','challenge');act('confirm');
act('preview-node','story');act('clear-preview');act('meal');act('tool','lens');assert(act('start-explore'));act('move','gather');act('choice','inspect');act('move','story');act('choice','hint');act('choice','solve');act('move','battle');act('choice','challenge');act('battle','guard');act('battle','skill');act('battle','guard');act('battle','attack');act('eat');act('return');act('cancel');act('return');act('confirm');act('claim');
act('page','base');act('repair');act('neighbor');act('neighbor');act('page','expedition');act('goal','sightsee');act('duration','120');assert(act('start-expedition'));act('companion','touch');act('companion','chat');act('page','journal');act('resume');act('fast-forward','node');act('recall');act('cancel');act('recall');act('confirm');act('claim');act('page','expedition');assert(act('start-expedition'));act('fast-forward','end');act('claim');
act('page','expedition');act('route','shortcut');assert(element('app').innerHTML.includes('标记的近路'));assert(act('start-expedition'));assert(P.getState().trip.fixedItems.every(id=>id==='蘑菇'));act('fast-forward','end');act('claim');
for(const action of actions)assert(read('ui.js').includes(`action==='${action}'`),'missing action '+action);
const css=postcss.parse(read('ui.css'));let rules=0;css.walkRules(()=>rules++);assert(rules>100);
for(const width of [360,540,850,1100])assert(read('ui.css').includes(`max-width:${width}px`));
console.log('PASS: exploration branches, food, usable shortcuts, 4-turn battle, failure/retreat, one-time rewards, expedition timing/refunds (30 cases), both unlock paths, bases/memories, all pages and controls, offline resources, and CSS syntax. Browser pixels/touch were not tested.');
